var inputbox = document.getElementById('searchInput');
var scrollBox = document.getElementById('scrollBox');
var searchRootContainer = document.getElementById('searchRootContainer');
var searchListContainer = document.getElementById('searchListContainer');

var footer = document.getElementById("footer");
var hitsText = document.getElementById("numHits")
var loadlAllBtn = document.getElementById("loadAll");
var clearBtn = document.getElementById("clear");
var themeBtn = document.getElementById("theme");

var docFrame = document.getElementById("docFrame");

var searchInput;
var lastSearchInput = "";
var workers = [];
var workerResults;
var numWorkersDone;
var lastAppendedResult;
var searchRunning = false;

loadlAllBtn.addEventListener("click", () => lazyAppendResults(true));
clearBtn.addEventListener("click", clearSearch);
themeBtn.addEventListener("click", switchTheme);

function on_data_loaded() {
  inputbox.addEventListener('keyup', function (e) {
    if(e.keyCode == 13){
      lastSearchInput = "";
      updateSearch(inputbox.value);
    }else{
      var delay = 300;
      if(inputbox.value.length == 1){delay = 1200}
      if(inputbox.value.length == 2){delay = 800}

      debounce(updateSearch, delay)(inputbox.value)
    }
  });

  inputbox.onfocus = function () {
      updateSearch(inputbox.value)
  }

  create_workers();

  inputbox.placeholder = "Search";
  show_loading(false);
  inputbox.disabled = false;

  updateSearch(inputbox.value);
}

function show_loading(show) {
  if(show) {inputbox.style["background-image"] = ""} else { inputbox.style["background-image"] = "none"}
}

function create_workers(){
  const chunkSize = 10000;
  for(i = 0; i < searchData.length; i += chunkSize) {
    var worker = new Worker(searchWorkerURL);
    worker.postMessage({cmd: "data", data: searchData.slice(i, i + chunkSize)});
    worker.addEventListener("message", onWorkerDone);
    workers.push(worker);
  }

  searchData = null;
}

function debounce(fun, delay) {
    return function (args) {
        let that = this
        let _args = args
        clearTimeout(fun.id)
        fun.id = setTimeout(function () {
            fun.call(that, _args)
        }, delay)
    }
}

function updateSearch(input){
  if(input != lastSearchInput){
    lastSearchInput = input;
    doSearch(input);
  }
}

function doSearch(input){
  if(input.length < 1 || searchRunning) {return}

  searchRunning = true;
  show_loading(true);
  clearSearch();
  searchInput = input;

  workers.forEach( (worker) => {
    worker.postMessage({cmd: "search", input: input});
  });
}

function onWorkerDone(e){
  workerResults.push(e.data);
  numWorkersDone++;

  if(numWorkersDone >= workers.length){
    workerResults = workerResults.flat(1);

    workerResults.sort(
      function(left, right){return bestMatchSortBy(left, right, searchInput)}
    );

    hitsText.innerHTML = workerResults.length + " Hits";
    footer.style.display = "";

    if(workerResults.length > 0){
      loadlAllBtn.style.display = "";
      clearBtn.style.display = "";
      lazyAppendResults();
    }
    else{
      loadlAllBtn.style.display = "none";
      clearBtn.style.display = "none";
    }

    searchRunning = false;
    show_loading(false);
  }
}

function typeRank(itm){
  if ("type" in itm){
    if(itm.type == "int") { return 4 } //interface
    if(itm.type == "cla") { return 3 } //class
    if(itm.type == "enu") { return 2 } //enum
    if(itm.type == "pkg") { return 1 } //package
  }

  return 0;
}

function bestMatchSortBy(left, right, input) {
  var leftRank = typeRank(left.item);
  var rightRank = typeRank(right.item);

  if(leftRank != rightRank){ return rightRank - leftRank }

  var leftContent = left.item.content.toLowerCase();
  var rightContent = right.item.content.toLowerCase();

  var leftURL = left.item.url.toLowerCase();
  var rightURL = right.item.url.toLowerCase();

  var theSearchContent = input.toLowerCase();

  // Make sure that those starting with the search content are easier to be searched
  if (leftContent.startsWith(theSearchContent) && !rightContent.startsWith(theSearchContent)) {
    return -1;
  } else if (!leftContent.startsWith(theSearchContent) && rightContent.startsWith(theSearchContent)) {
    return 1;
  }

  if (leftURL.includes(theSearchContent) && !rightURL.includes(theSearchContent)){
    return -1;
  }else if (!leftURL.includes(theSearchContent) && rightURL.includes(theSearchContent)) {
    return 1;
  }

  var leftDistance = left.leven_dist;
  var rightDistance = right.leven_dist;

  if(leftDistance == undefined) {
      leftDistance = 0;
  }
  if(rightDistance == undefined) {
      rightDistance = 0;
  }
  return leftDistance - rightDistance;
}

function createSearchItem(searchInput, jsonItem, number) {
    var content = jsonItem.content;
    var url = jsonItem.url;

    var container = document.createElement('div');
    container.setAttribute('class','searchHit');

      var container2 = document.createElement('div');
        container2.innerHTML = getContentHtml(content, searchInput, jsonItem.type);
        
        var urlView = document.createElement('div');
        urlView.setAttribute('class','searchUrl');
        urlView.textContent = url;

        container2.appendChild(urlView);

      var contentNum = document.createElement('div');
      contentNum.setAttribute('class','searchNum');
      contentNum.textContent = number.toString();

    container.appendChild(container2);
    container.appendChild(contentNum);

    container.addEventListener('click', ((_url) => {return (e) => {
      try{
        var cont = docFrame.contentDocument || docFrame.contentWindow.document;

        if(_url.endsWith("package-frame.html")){
          var packageFrame = cont.querySelector("frame[name=packageFrame]");
          packageFrame.src = _url;
        }
        else{
          var classFrame = cont.querySelector("frame[name=classFrame]");
          classFrame.src = _url;
        }
      }catch(error){
        window.open(_url)
      }
    }})(url));

    container.addEventListener("mouseenter", (e) => {
      e.target.style["max-height"] = e.target.scrollHeight * 1.1 + "px";
    });

    container.addEventListener("mouseleave", (e) => {
      e.target.style["max-height"] = "";
    });

    return container;
}

function clearSearch() {
  while (searchListContainer.firstChild) {
      searchListContainer.removeChild(searchListContainer.lastChild);
  }

  workerResults = [];
  numWorkersDone = 0;
  lastAppendedResult = 0;
  footer.style.display = "none";
}

function getContentHtml(content, keyword, type) {
  content = content.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"); //these characters break the html
  keyword = keyword.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"); //we must do the same for keyword or the .replace will fail

  keyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); //keyword may contain special characters which mess up the regEx

  var key_reg = new RegExp("(" + keyword + ")", "ig"); 
  var key_repl = "<span class='hit_keyword'>$1</span>";

  if(type !== undefined){
    //we have a type, so content should be e.g. "Class xyz". Wrap "Class" in span

    let re = new RegExp("^(.+?) (.+)$");
    var match = content.match(re);

    if(match && match.length == 3){
      return "<span class='hit_" + type + "'>" + match[1] + " </span>" +
        match[2].replace(key_reg, key_repl);
    }
  }
  
  return content.replace(key_reg, key_repl); 
}

function onSearchListScroll(e){
  if(scrollBox.scrollTop == scrollBox.scrollHeight - scrollBox.clientHeight){
    lazyAppendResults();
  }
}

function lazyAppendResults(all = false){
  var target = all ? workerResults.length : lastAppendedResult + 100;

  while (lastAppendedResult < target && lastAppendedResult < workerResults.length){
    var itm = workerResults[lastAppendedResult].item

    searchListContainer.appendChild(createSearchItem(searchInput, itm, lastAppendedResult + 1));
    lastAppendedResult++;
  }

  if (lastAppendedResult >= workerResults.length){
    loadlAllBtn.style.display = "none";
  }
}


var resizeBar = document.getElementById("resizeBar");
var resizeWrapper = resizeBar.parentElement;
var resizeTarget = document.getElementById("searchRootContainer");
var isResizing = false;

resizeTarget.style.width = resizeTarget.clientWidth + "px"; //set width so it doesnt jump around when results appear

document.addEventListener('mousedown', function(e) {
  if (e.target === resizeBar) {
    isResizing = true;
    docFrame.style["pointer-events"] = "none";
    searchRootContainer.style["user-select"] = "none";
  }
});

document.addEventListener('mousemove', function(e) {
  if (isResizing) {

    var wOffLeft = resizeWrapper.offsetLeft;

    // Get x-coordinate of pointer relative to container
    // - half bar width
    var pointerRelativeXpos = e.clientX - wOffLeft - 8;

    var min = 0;
    var max = window.innerWidth - wOffLeft - 15;
    
    resizeTarget.style.width = Math.min(max, Math.max(min, pointerRelativeXpos)) + 'px';
  }
});

document.addEventListener('mouseup', function(e) {
    isResizing = false;
    docFrame.style["pointer-events"] = "";
    searchRootContainer.style["user-select"] = "";
});

function switchTheme(){
  for (var i=0; i < document.styleSheets.length; i++) {
    var sheet = document.styleSheets.item(i);

    if(sheet.ownerNode.attributes["href"].value == "search/dark.css"){
      void(sheet.disabled = !sheet.disabled);
    }
  }
}