var searchWorkerURL;

(() => {
    function search(input) {
        var hits = [];
        var inp_lower = input.toLowerCase();

        searchData.forEach( (itm) => {
            var cont_lower = itm.content.toLowerCase();

            if(cont_lower.indexOf(inp_lower) > -1) {

                hits.push({item: itm, leven_dist: getLevenshteinDistance(cont_lower, inp_lower)});
            }
        });

        self.postMessage(hits);
    }

    //获取最小编辑距离
    function getLevenshteinDistance(leftStr, rightStr) {
      if (leftStr == null || rightStr == null) {
          return 0;
      }

      leftLen = leftStr.length; 
      rightLen = rightStr.length;

      if (leftLen == 0) {
          return rightLen;
      } else if (rightLen == 0) {
          return leftLen;
      }

      if (leftLen > rightLen) {
          // swap the input strings to consume less memory
          tmp = leftStr;
          leftStr = rightStr;
          rightStr = tmp;
          leftLen = rightLen;
          rightLen = rightStr.length;
      }

      previousCostArr = []; //'previous' cost array, horizontally
      costArr = []; // cost array, horizontally
      placeholderForSwappingCostArr = []; //placeholder to assist in swapping previousCostArr and costArr

      rightStr_j = "";

      cost = 0; // cost

      for (i = 0; i <= leftLen; i++) {
          previousCostArr[i] = i;
      }

      for (j = 1; j <= rightLen; j++) {
          rightStr_j = rightStr.charAt(j - 1);
          costArr[0] = j;

          for (i = 1; i <= leftLen; i++) {
              cost = leftStr.charAt(i - 1) === rightStr_j ? 0 : 1;
              // minimum of cell to the left+1, to the top+1, diagonally left and up +cost
              costArr[i] = Math.min(Math.min(costArr[i - 1] + 1, previousCostArr[i] + 1), previousCostArr[i - 1] + cost);
          }

          // copy current distance counts to 'previous row' distance counts
          placeholderForSwappingCostArr = previousCostArr;
          previousCostArr = costArr;
          costArr = placeholderForSwappingCostArr;
      }

      // our last action in the above loop was to switch d and p, so p now 
      // actually has the most recent cost counts
      return previousCostArr[leftLen];
    }

    function onMessage(e){
        if (e.data.cmd == "data"){
            searchData = e.data.data;
        }
        else if (e.data.cmd == "search"){
          search(e.data.input);
        }
    }

    var blob = new Blob([ 
        onMessage.toString() + "\r\n" +
        search.toString() + "\r\n" +
        getLevenshteinDistance.toString() + "\r\n" +
        "var searchData; self.addEventListener('message', onMessage);"
    ], {type: "application/javascript"});

    searchWorkerURL = URL.createObjectURL(blob);
})()