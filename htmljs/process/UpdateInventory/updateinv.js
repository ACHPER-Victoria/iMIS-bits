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

var myWorker = new Worker('/common/Uploaded%20Files/Code/updateinventory/UpdateInvWorker.js');

function mergelog(s) {
  var ta = jQuery('textarea#mergelog');
  ta.val(ta.val() + s + "\n")
}
function updateProgress(i) {
  jQuery('span#mergecount').text(i);
}
function setMaxProgress(i) {
  jQuery('span#mergetotal').text(i);
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
  if (type === 'mergelog') {
    mergelog(data);
  } else if (type === 'updateProgress') {
    updateProgress(data);
  } else if (type === 'setMaxProgress') {
    setMaxProgress(data);
  } else if (type === 'getCategories') {
    populateCats(data);
  } else if (type === 'endProcessing') {
    endProcessing(data);
  } else {
    console.error('An Invalid type has been passed in');
  }
}

function getCategories() {
  disableUI(true);
  jQuery('textarea#mergelog').val("");
  workerMaker('getCategories', [document.getElementById("__RequestVerificationToken").value]);
}
function populateCats(events) {
  var selectfield = jQuery("#CatPullDown");
  jQuery('#EventPullDown option:gt(0)').remove(); // remove all options, but not the first
  for (let i of events) {
    selectfield.append(jQuery("<option></option>")
       .attr("value", i[0]).text(i[1]));
  }
  disableUI(false, true);
}

function disableUI(disable, start=true) {
  if (disable) {
    document.getElementById("CatPullDown").setAttribute("disabled", "disabled");
    document.getElementById("amount").setAttribute("disabled", "disabled");
    document.getElementById("reduce2zero").setAttribute("disabled", "disabled");
    document.getElementById("resetbutton").setAttribute("disabled", "disabled");
    if (start) { document.getElementById("startbutton").setAttribute("disabled", "disabled"); }
  } else {
    document.getElementById("CatPullDown").removeAttribute("disabled");
    document.getElementById("amount").removeAttribute("disabled");
    document.getElementById("reduce2zero").removeAttribute("disabled");
    document.getElementById("resetbutton").removeAttribute("disabled");
    if (start) { document.getElementById("startbutton").removeAttribute("disabled"); }
  }
}

function startUpdate() {
  // allow not everyone and no alliances from to clear a list.
  jQuery('textarea#mergelog').val("");
  var cat = jQuery("#CatPullDown").val();
  var amount = jQuery("#amount").val();
  var zero = jQuery("#reduce2zero").is(":checked");
  amount = parseInt(amount)
  if (isNaN(amount)) {
    mergelog("Invalid amount.");
    return;
  }
  // require eventid and regoptid
  if (!cat) {
    mergelog("Require Category.");
    return;
  }
  // disableUI
  disableUI(true);
  workerMaker('startProcessing', [document.getElementById("__RequestVerificationToken").value,
    cat, amount, zero]);
}

function endProcessing(data) {
  mergelog("Done.");
  disableUI(false, true);
}

window.addEventListener("load", _ => {
  getCategories();
});
