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

function endProcessing(data) {
  var downlist = document.getElementById("downlist");
  for(let [k,v] of Object.entries(data)) {
    var node = document.createElement("li");
    if (v != false) {
      v = "\ufeff"+v;
      var csvData = new Blob([v], {type: 'text/csv;charset=utf-8;'});
      var exportFilename = "{0}.csv".format(k)
      var link = document.createElement('a');
      link.href = window.URL.createObjectURL(csvData);
      link.setAttribute('download', exportFilename);
      link.innerHTML = exportFilename;
    } else {
      var link = document.createElement('span');
      link.innerHTML = k+" - 0";
    }
    node.appendChild(link);
    downlist.appendChild(node);
    disableUI(false, true);
  }
}

function startProcessing() {
  workerMaker('startProcessing', [document.getElementById("__RequestVerificationToken").value,
    document.getElementById("startdate").value, document.getElementById("enddate").value,
    jQuery("#incanec").is(":checked"), jQuery("#inccontext").is(":checked"), jQuery("#inckpn").is(":checked")]);
  disableUI(true, true);
}

function disableUI(disable, start=false) {
  if (disable) {
    document.getElementById("enddate").setAttribute("disabled", "disabled");
    document.getElementById("startdate").setAttribute("disabled", "disabled");
    if (start) { document.getElementById("startbutton").setAttribute("disabled", "disabled"); }
  } else {
    document.getElementById("enddate").removeAttribute("disabled");
    document.getElementById("startdate").removeAttribute("disabled");
    if (start) { document.getElementById("startbutton").removeAttribute("disabled"); }
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
  if (type === 'endProcessing') {
    endProcessing(data);
  } else if (type === 'exportlog') {
    exportlog(data);
  } else if (type === 'exportprogress') {
    updateProgress(data);
  } else if (type == 'exporttotal') {
    jQuery('span#exporttotal').text(data);
  } else {
    console.error('An Invalid type has been passed in');
  }
}

function getCount() {
  // set expected count
  jQuery.ajax("/api/Party?isOrganization=true&Status=A",
  {
    type : "get",
    contentType: "application/json",
    async: true,
    headers: { "RequestVerificationToken": document.getElementById("__RequestVerificationToken").value },
    success: function(data) {
      jQuery('span#exporttotal').text(data["TotalCount"]);
    }
  });
}

function np(n) {
  return String(n).padStart(2, '0');
}
window.addEventListener("DOMContentLoaded", () => {
    const d = new Date();
    const ld = new Date(Date.UTC(d.getFullYear(), d.getMonth()+1, 0));
    document.getElementById("startdate").value = "{0}-{1}-01".format(d.getFullYear(), np(d.getMonth()+1));
    document.getElementById("enddate").value = ld.toISOString().split('T')[0];
    getCount();
});
