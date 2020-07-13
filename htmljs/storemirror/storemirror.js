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

var myWorker = new Worker('/common/Uploaded%20Files/Code/storemirror/StoreMirrorWorker.js');
var MODAL = null;
var STATUS = null;

const workerMaker = (type, arg) => {
  // check if a worker has been imported
  if (window.Worker) {
    myWorker.postMessage({type, arg});
  }
}

function synclog(s) {
  var ta = jQuery('textarea#synclog');
  ta.val(ta.val() + s + "\n")
}
function actionlog(s) {
  var ta = jQuery('textarea#actionlog');
  ta.val(ta.val() + s + "\n")
}

myWorker.onmessage = function(e) {
  //console.log('Message received from worker');
  const response = e.data;
  const data = response.data;
  const type = response.type;
  if (type === 'syncDone') {
    complete(data);
  } else if (type === 'synclog'){
    synclog(data);
  } else if (type === 'actionlog'){
    actionlog(data);
  } else if (type === 'totalcount'){
    jQuery('span#totalcount').text(data);
  } else if (type === 'currentcount'){
    jQuery('span#currentcount').text(data);
  } else {
    console.error('An Invalid type has been passed in');
  }
}

function initSyncPage() {
  // Preload categories.
  jQuery('input#storecategories').val("CHARTS,UNITPLANS,VCE-SACS,VCE-TE,VCE-VET,WEBREC,VIC-EL,HPEH");
}
function startSync() {
  STATUS = false;
  var categories = jQuery('input#storecategories').val();
  var percentdisc = jQuery('input#percentdisc').val();
  var freeitems = jQuery('input#freeitems').val();
  workerMaker('startSync', [document.getElementById("__RequestVerificationToken").value, categories, percentdisc, freeitems]);
}

function complete(data) {
  synclog("Done.");
}
