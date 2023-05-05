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
var myWorker = new Worker('/common/Uploaded%20Files/Code/as/BulkContactHistory/BulkContactHistoryWorker.js');
const workerMaker = (type, arg) => {
  // check if a worker has been imported
  if (window.Worker) {
    myWorker.postMessage({type, arg});
  }
}
const self = this;
myWorker.onmessage = function(e) {
  //console.log('Message received from worker');
  const response = e.data;
  const data = response.data;
  const type = response.type;
  if (type in self) { self[type](data); }
  else { console.error('Invalid type has been passed in'); }
}

function getToken() { return document.getElementById("__RequestVerificationToken").value; }
function setToken() { return; } // return back from worker, do nothing.
function exportlog(s) { var ta = jQuery('textarea#exportlog'); ta.val(ta.val() + s + "\n"); }
// set expected count
function updateTotal(data) { jQuery('span#exporttotal').text(data); }
function updateProgress(i) { jQuery('span#exportcount').text(i); }
function endProcessing(data) { disableUI(false); }

function getUserID() { return JSON.parse(document.getElementById("__ClientContext").value).loggedInPartyId; }

function disableUI(disable) {
  if (disable) { document.getElementById("startbutton").setAttribute("disabled", "disabled"); }
  else { document.getElementById("startbutton").removeAttribute("disabled"); }
}

var LOADED = [ false, false, false, false, false ];

function removeOptions(selectElement) {
  var i = selectElement.options.length - 1;
   for(; i >= 0; i--) { selectElement.remove(i); }
}
function populateOptions(id, data, selected=null, autosize=true) {
  const select = document.getElementById(id);
  removeOptions(select);
  if (autosize) { select.size = data.length; }
  for (const [code, name] of data) {
    const opt = document.createElement("option");
    opt.value = code; opt.text = name;
    if (code == selected) { opt.selected = true; }
    select.add(opt);
  }
}

var SCHOOLDATA = [];

function createFilterList() {
  let opts = new Set();
  for (const [x,y,z] of SCHOOLDATA) { if (z != "") { opts.add(z); } }
  let data = [["", "*All*"]];
  for (const val of opts) { data.push([val,val]); }
  if (data.length > 1) {
    populateOptions("listname", data);
    document.getElementById('listname').addEventListener('change', changefilter);
    document.getElementById('listname').style.display = 'inline-block'
    document.getElementById('listnameid').style.display = 'inline-block'
  }
}

function getMySchools(data) {
  SCHOOLDATA = data;
  populateOptions("myschools", data);
  createFilterList();
  loadeditem(0);
}
function getContactTypes(data) {
  populateOptions("contacttype", data, null, false);
  loadeditem(1);
}
function getFCs(data) {
  populateOptions("fc", data);
  loadeditem(2);
}
function getStaff(data) {
  populateOptions("staff", data, getUserID(), false);
  loadeditem(3);
}
function getSupportTypes(data) {
  populateOptions("supporttypes", data, getUserID());
  loadeditem(4);
}

function loadeditem(i, loaded=true) {
  LOADED[i] = loaded;
  if (LOADED.every((a) => { return a; })) {
    disableUI(false);
  } else {
    disableUI(true);
  }
}
function resetProgress() {
  updateProgress("-");
  updateTotal("-");
}
function startProcessing() {
  //re-enable button on finish
  disableUI(false);
}
function start() {
  resetProgress();
  jQuery('textarea#exportlog').val("");
  workerMaker('startProcessing', {
    "myschools": [...document.getElementById("myschools").selectedOptions].map(o=>o.value),
    "extraschools": document.getElementById("extraschools").value,
    "startdate" : document.getElementById("startdate").value,
    "contacttype": document.getElementById("contacttype").value,
    "pdattendees": document.getElementById("pdattendees").value,
    "fc": [...document.getElementById("fc").selectedOptions].map(o=>o.value),
    "staff": document.getElementById("staff").value,
    "supporttypes": [...document.getElementById("supporttypes").selectedOptions].map(o=>o.value),
    "summary": document.getElementById("summary").value,
  });
  disableUI(true);
}

function changefilter(event) {
  let choices = [...event.target.selectedOptions].map(o=>o.value);
  populateOptions("myschools", SCHOOLDATA.filter(i=>{ return choices.includes("") || choices.includes(i[2]); }) );
}

function np(n) { return String(n).padStart(2, '0'); } // PADDING FUNC FOR DATE
window.addEventListener("DOMContentLoaded", () => {
  disableUI(true);
  workerMaker('setToken', getToken());
  const d = new Date();
  document.getElementById("startdate").value = "{0}-{1}-{2}".format(d.getFullYear(), np(d.getMonth()+1), np(d.getDate()));
  // get school list
  workerMaker('getMySchools', getUserID());
  // get types of contact`
  workerMaker('getContactTypes', []);
  // get funding categories
  workerMaker('getFCs', []);
  // get staff members
  workerMaker('getStaff', []);
  // get types of support
  workerMaker('getSupportTypes', []);
  resetProgress();
});
