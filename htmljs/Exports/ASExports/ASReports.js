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
var myWorker = new Worker('/common/Uploaded%20Files/Code/ASExports/ASReportWorker.js');

function exportlog(s) {
  var ta = jQuery('textarea#exportlog');
  ta.val(ta.val() + s + "\n")
}
function updateProgress(i) {
  jQuery('span#exportcount').text(i);
}

DOWNLINKS = ["NotFound", "Found"]; //nf, found
function endProcessing(data) {
  var downlist = document.getElementById("downlist");
  for(var i=0;i<DOWNLINKS.length;i++) {
    var node = document.createElement("li");
    if (data[i] != false) {
      data[i] = "\ufeff"+data[i];
      var csvData = new Blob([data[i]], {type: 'text/csv;charset=utf-8;'});
      var exportFilename = "{0}-{1}.csv".format(DOWNLINKS[i], (new Date()).toISOString().slice(0,16))
      var link = document.createElement('a');
      link.href = window.URL.createObjectURL(csvData);
      link.setAttribute('download', exportFilename);
      link.innerHTML = exportFilename;
    } else {
      var link = document.createElement('span');
      link.innerHTML = DOWNLINKS[i]+" - 0";
    }
    node.appendChild(link);
    downlist.appendChild(node);
    disableUI(false, true);
  }
}

function runReport() {
  // set expected count
  jQuery.ajax("/api/Organization",
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
  workerMaker('startProcessing', [document.getElementById("__RequestVerificationToken").value,
    document.getElementById("startdate").value, document.getElementById("enddate").value]);
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
  if (type === 'endProcessing') {
    endProcessing(data);
  } else if (type === 'exportlog') {
    exportlog(data);
  } else if (type === 'exportprogress') {
    updateProgress(data);
  } else {
    console.error('An Invalid type has been passed in');
  }
}



window.addEventListener("DOMContentLoaded", () => {
    const d = new Date();
    const ld = new Date(Date.UTC(d.getFullYear(), d.getMonth()+1, 0));
    document.getElementById("startdate").value = "{0}-{1}-01".format(d.getFullYear(), d.getMonth()+1);
    document.getElementById("enddate").value = ld.toISOString().split('T')[0]
});
