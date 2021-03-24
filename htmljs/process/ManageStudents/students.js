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
var myWorker = new Worker('/common/Uploaded%20Files/Code/ManageStudents/studentWorker.js');

var eventid = (new URLSearchParams(window.location.search)).get("EventKey")

function updateProgress(i, total=false) {
  if (total) jQuery('span#importtotal').text(i);
  else jQuery('span#importcount').text(i);
}

function startProcessing() {
  // set expected count
  disableUI();

  workerMaker('startProcessing', [document.getElementById("__RequestVerificationToken").value]);
}

const workerMaker = (type, arg) => {
  // check if a worker has been imported
  if (window.Worker) {
    myWorker.postMessage({type, arg});
  }
}

function disableUI(disable, start=true) {
  if (disable) {
    if (start) { document.getElementById("startbutton").setAttribute("disabled", "disabled"); }
  } else {
    if (start) { document.getElementById("startbutton").removeAttribute("disabled"); }
  }
}

myWorker.onmessage = function(e) {
  //console.log('Message received from worker');
  const response = e.data;
  const data = response.data;
  const type = response.type;
  if (type === 'importprogress') {
    updateProgress(data);
  } else if (type === 'importtotal') {
    updateProgress(data, true);
  } else if (type === 'fin') {
    // reload page
    window.location.reload();
  } else {
    console.error('An Invalid type has been passed in');
  }
}

window.addEventListener("load", _ => {
  workerMaker('getTotal', [document.getElementById("__RequestVerificationToken").value]);
});
