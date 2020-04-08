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

var myWorker = new Worker('/common/Uploaded%20Files/Code/alliance/AllianceProcessWorker-1.js');

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

function saveFile(data) {
  var csvData = new Blob(["\ufeff"+data], {type: 'text/csv;charset=utf-8;'});
  var exportFilename = "{0}-{1}.csv".format(eventid, (new Date()).toISOString().slice(0,10))
  importlog("Downloading now...");
  //IE11 & Edge
  if (navigator.msSaveBlob) {
      navigator.msSaveBlob(csvData, exportFilename);
  } else {
      //In FF link must be added to DOM to be clicked
      var link = document.createElement('a');
      link.href = window.URL.createObjectURL(csvData);
      link.setAttribute('download', exportFilename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  }
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
  if (type === 'csvFormat') {
    saveFile(data);
  } else if (type === 'importlog') {
    importlog(data);
  } else if (type === 'updateProgress') {
    updateProgress(data);
  } else if (type === 'setMaxProgress') {
    setMaxProgress(data);
  } else if (type === 'getFieldItems') {
    populatePullDownData(data);
  } else if (type === 'createAlliance') {
    createAllianceDone(data);
  } else if (type === 'getHeaders') {
    handleFilesDone(data);
  } else if (type === 'endProcessing') {
    endProcessing(data);
  } else if (type == 'ping') {
    setTimeout(doPing, 5000);
  } else {
    console.error('An Invalid type has been passed in');
  }
}

function populateFields() {
  disableUI(true);
  jQuery('textarea#importlog').val("");
  workerMaker('getFieldItems', [document.getElementById("__RequestVerificationToken").value]);
}

function populatePullDownData(data) {
  var selectfield = jQuery("#AlliancePullDown");
  jQuery('#AlliancePullDown option:gt(0)').remove(); // remove all options, but not the first
  for (let i of data[0]) {
    selectfield.append(jQuery("<option></option>")
       .attr("value", i[0]).text(i[1]));
  }
  selectfield = jQuery("#SubscribePullDown");
  jQuery('#SubscribePullDown option:gt(0)').remove(); // remove all options, but not the first
  for (let i of data[1]) {
    selectfield.append(jQuery("<option></option>")
       .attr("value", i[0]).text(i[1]));
  }
  disableUI(false);
}

function disableUI(disable, start=false) {
  if (disable) {
    document.getElementById("createAlliance").setAttribute("disabled", "disabled");
    document.getElementById("clist").setAttribute("disabled", "disabled");
    document.getElementById("resetbutton").setAttribute("disabled", "disabled");
    if (start) { document.getElementById("startbutton").setAttribute("disabled", "disabled"); }
  } else {
    document.getElementById("createAlliance").removeAttribute("disabled");
    document.getElementById("clist").removeAttribute("disabled");
    document.getElementById("resetbutton").removeAttribute("disabled");
    if (start) { document.getElementById("startbutton").removeAttribute("disabled"); }
  }
}

function createAlliance() {
  disableUI(true);
  // worker
  // code newAllianceCodeInput
  var code = document.getElementById("newAllianceCodeInput").value
  // desc newAllianceDescInput
  var desc = document.getElementById("newAllianceDescInput").value
  if (!code) {
    importlog("Missing code.");
    disableUI(false); return;
  }
  if (!desc) {
    importlog("Missing description.");
    disableUI(false); return;
  }
  workerMaker('createAlliance', [document.getElementById("__RequestVerificationToken").value, code, desc]);
}
function createAllianceDone(data) {
  if (data) {
    importlog("Created Alliance, refreshing list...");
    populatePullDown();
  } else {
    importlog("Failed to create Alliance.");
    disableUI(false);
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
FIELDS = [["ID", "uid"], ["First Name", "firstname"], ["Last Name", "lastname"],
  ["Email address", "email"], ["Phone", "phone"]];
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
    "uid" : jQuery("#uid").val(),
    "firstname" : jQuery("#firstname").val(),
    "lastname" : jQuery("#lastname").val(),
    "email" : jQuery("#email").val(),
    "phone" : jQuery("#phone").val(),
  }
  var alliances = jQuery("#AlliancePullDown").val();
  var subscribes = jQuery("#SubscribePullDown").val();
  jQuery('#downlist li').remove();
  workerMaker('startProcessing', [document.getElementById("__RequestVerificationToken").value,
    CSVFILE, fields, alliances, subscribes]);
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
  workerMaker('ping', [document.getElementById("__RequestVerificationToken").value]);
}

setTimeout(doPing, 5000);
