var inputbox = document.getElementById('searchInput');
var scrollBox = document.getElementById('scrollBox');
var searchListContainer = document.getElementById('searchListContainer');

var footer = document.getElementById("footer");
var hitsText = document.getElementById("numHits")
var loadlAllBtn = document.getElementById("loadAll");
var clearBtn = document.getElementById("clear");

var docFrame = document.getElementById("docFrame");

var searchInput;
var lastSearchInput = "";
var workers = [];
var workerResults;
var numWorkersDone;
var lastAppendedResult;
var searchRunning = false;

loadlAllBtn.addEventListener("click", () => lazyAppendResults(true));
clearBtn.addEventListener("click", () => clearSearch());

function on_data_loaded() {
  inputbox.addEventListener('keyup', function (e) {
    if(e.keyCode == 13){
      lastSearchInput = "";
      updateSearch(inputbox.value);
    }else{
      debounce(updateSearch, 300)(inputbox.value)
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

function bestMatchSortBy(left, right, input) {
    leftContent = left.item.content.toLowerCase();
    rightContent = right.item.content.toLowerCase();
    theSearchContent = input.toLowerCase();

    // 先保证以搜索内容为开头的更容易被搜索到
    if (leftContent.startsWith(theSearchContent) && !rightContent.startsWith(theSearchContent)) {
        return -1;
    } else if (!leftContent.startsWith(theSearchContent) && rightContent.startsWith(theSearchContent)) {
        return 1;
    }

    leftDistance = left.leven_dist;
    rightDistance = right.leven_dist;

    if(leftDistance == undefined) {
        leftDistance = 0;
    }
    if(rightDistance == undefined) {
        rightDistance = 0;
    }
    return leftDistance - rightDistance;
}

function createSearchItem(searchContent, jsonItem) {
    content = jsonItem.content;
    url = jsonItem.url;

    container = document.createElement('ul');
    container.setAttribute('class','searchContent');

    contentView = document.createElement('li');
    contentView.innerHTML = highLightKeyWord(searchContent, content);
    //urlView = document.createElement('div');

    container.appendChild(contentView);
    container.append(url);

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

function highLightKeyWord(keyword, targetContent) { 
    /* 获取需要处理的关键字 */ 
    var resultHtml = targetContent; 
    /* 关键字替换文本 该文本设置有高亮颜色 */ 
    var replaceText = "<font style='color:red;'>$1</font>"; 
    /* 关键字正则匹配规则 */ 
    var r = new RegExp("(" + keyword + ")", "ig"); 
    /* 将匹配到的关键字替换成我们预设的文本 */ 
    resultHtml = resultHtml.replace(r, replaceText); 
    /* 用于innerHTML */ 
    return resultHtml;
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
    itm.content = (lastAppendedResult + 1) + " " + itm.content;

    searchListContainer.appendChild(createSearchItem(searchInput, itm));
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
});