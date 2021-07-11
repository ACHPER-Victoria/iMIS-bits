if (!String.prototype.format) {
  String.prototype.format = function() {
    var args = arguments;
    return this.replace(/{(\d+)}/g, function(match, number) {
      return typeof args[number] != 'undefined'
        ? args[number]
        : match
      ;
    });
  };
}

var myWorker = new Worker('/common/Uploaded%20Files/Code/vs/vsWorker.js');

function importlog(s) {
  var ta = jQuery('textarea#importlog');
  ta.val(ta.val() + s + "\n")
}
function updateProgress(i) {
  jQuery('span#importcount').text(i);
}
function setMaxProgress(i) {
  jQuery('span#importtotal').text(i);
}

const workerMaker = (type, arg) => {
  // check if a worker has been imported
  if (window.Worker) {
    myWorker.postMessage({type, arg});
  }
}

myWorker.onmessage = function(e) {
  //console.log('Message received from worker');
  const response = e.data;
  const data = response.data;
  const type = response.type;
  if (type === 'importlog') {
    importlog(data);
  } else if (type === 'updateProgress') {
    updateProgress(data);
  } else if (type === 'setMaxProgress') {
    setMaxProgress(data);
  } else if( type === 'getFieldItems') {
    populatePullDownData(data);
  } else if( type === 'getHeaders') {
    handleFilesDone(data);
  } else if( type === 'endProcessing') {
    endProcessing(data);
  } else {
    console.error('An Invalid type has been passed in');
  }
}

function disableUI(disable, start=false) {
  if (disable) {
    document.getElementById("resetbutton").setAttribute("disabled", "disabled");
    if (start) { document.getElementById("startbutton").setAttribute("disabled", "disabled"); }
  } else {
    document.getElementById("resetbutton").removeAttribute("disabled");
    if (start) { document.getElementById("startbutton").removeAttribute("disabled"); }
  }
}

CSVFILE = null;
function handleFiles(flist) {
  // clear csvfields
  disableUI(true);
  jQuery('#csvfields li').remove();
  // getHeaders
  CSVFILE = flist[0]
  workerMaker('getHeaders', [document.getElementById("__RequestVerificationToken").value, CSVFILE]);
}
FIELDS = [["School Type", "schooltype"], ["SFOE Band", "sfoeband"], ["School no.", "schoolno"],
  ["SFOE Index", "sfoeindex"], ["Region name", "region"], ["LGA Name", "lga"],
  ["Area Name", "area"], ["SSV Region Abbreviation", "ssvregabb"], ["SSV Region", "ssvregion"]];
function handleFilesDone(headers) {
  var listelem = jQuery("#csvfields");
  FIELDS.forEach(function(i) {
    // create select list item
    var s = jQuery("<select id='{0}'></select>".format(i[1]));
    s.append(jQuery("<option></option>").attr("value", "").text("(NONE)"));
    headers.forEach(function (h) {
      s.append(jQuery("<option></option>").attr("value", h).text(h));
    });
    listelem.append(jQuery("<li></li>").append(jQuery("<span>{0}</span>".format(i[0])).add(s)));
  });
  if (headers != null) {
    document.getElementById("startbutton").removeAttribute("disabled");
  } else {
    document.getElementById("startbutton").setAttribute("disabled", "disabled");
  }
  disableUI(false);
}

function startProcessing() {
  if (CSVFILE === null) { importlog("No file selected"); return; }
  // get headerfields
  disableUI(true, true);
  var fields = {
    "schooltype" : jQuery("#schooltype").val(),
    "sfoeband" : jQuery("#sfoeband").val(),
    "schoolno" : jQuery("#schoolno").val(),
    "sfoeindex" : jQuery("#sfoeindex").val(),
    "region" : jQuery("#region").val(),
    "lga" : jQuery("#lga").val(),
    "area" : jQuery("#area").val(),
    "ssvregabb" : jQuery("#ssvregabb").val(),
    "ssvregion" : jQuery("#ssvregion").val(),
  }
  jQuery('#downlist li').remove();
  workerMaker('startProcessing', [document.getElementById("__RequestVerificationToken").value,
    CSVFILE, fields]);
}
DOWNLINKS = ["NotFound", "NotUnique", "Found"]; //nf, nu, found
function endProcessing(data) {
  var downlist = document.getElementById("downlist");
  for(var i=0;i<DOWNLINKS.length;i++) {
    if (data[i]) { data[i] = "\ufeff"+data[i]; }
    var csvData = new Blob([data[i]], {type: 'text/csv;charset=utf-8;'});
    var exportFilename = "{0}-{1}.csv".format(DOWNLINKS[i], (new Date()).toISOString().slice(0,16))
    var node = document.createElement("li");
    var link = document.createElement('a');
    link.href = window.URL.createObjectURL(csvData);
    link.setAttribute('download', exportFilename);
    link.innerHTML = exportFilename;
    node.appendChild(link);
    downlist.appendChild(node);
    disableUI(false, true);
  }
}

function doPing() {
  iMISaPing();
}

window.addEventListener("DOMContentLoaded", () => { setTimeout(doPing, 50000); });
