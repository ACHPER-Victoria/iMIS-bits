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
var myWorker = new Worker('/common/Uploaded%20Files/Code/EventReportWorker-35.js');

var eventid = (new URLSearchParams(window.location.search)).get("EventKey")

function exportlog(s) {
  var ta = jQuery('textarea#exportlog');
  ta.val(ta.val() + s + "\n")
}
function updateProgress(i) {
  jQuery('span#exportcount').text(i);
}

function saveFile(data) {
  var csvData = new Blob(["\ufeff"+data], {type: 'text/csv;charset=utf-8;'});
  var exportFilename = "{0}-{1}.csv".format(eventid, (new Date()).toISOString().slice(0,10))
  exportlog("Downloading now...");
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

function runReport() {
  // set expected count
  jQuery.ajax("/api/CsEvent/{0}".format(eventid),
  {
    type : "get",
    contentType: "application/json",
    async: true,
    headers: { "RequestVerificationToken": document.getElementById("__RequestVerificationToken").value },
    success: function(data) {
      data["Properties"]["$values"].forEach(function(pi) {
        if (pi["Name"] == "TotalRegistrants") {
          jQuery('span#exporttotal').text(pi["Value"]["$value"]);
        }
      });
    }
  });
  workerMaker('csvFormat', [eventid, document.getElementById("__RequestVerificationToken").value]);
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
  } else if (type === 'exportlog') {
    exportlog(data);
  } else if (type === 'exportprogress') {
    updateProgress(data);
  } else {
    console.error('An Invalid type has been passed in');
  }
}
