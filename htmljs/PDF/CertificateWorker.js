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

importScripts('/common/Uploaded%20files/Code/PDF/pdfkit.standalone.js')
importScripts('/common/Uploaded%20files/Code/PDF/blob-stream.js')
TOKEN = null;

onmessage = function(e) {
    const data = e.data;
    const type = data.type;
    const arg = data.arg;
    // console.log('Message received from main script');
    switch (type) {
      case 'MakeCert':
        // console.log('Posting message back to main script');
        // generate CSVdata
        // eventid, userid, prodcode, token
        TOKEN = arg[3];
        startProcess(arg[0], arg[1], arg[2]);
        break;
      default:
        console.error('invalid type passed in');
        break;
    }
}
MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function formatDate(s, e) {
  var sd = new Date(Date.parse(s));
  var ed = new Date(Date.parse(e));
  if (sd.getDate() == ed.getDate()){
    return "{0} {1} {2}".format(sd.getDate(), MONTHS[sd.getMonth()], sd.getFullYear());
  } else {
    return "{0}-{1} {2} {3}".format(sd.getDate(), ed.getDate(), MONTHS[sd.getMonth()], sd.getFullYear());
  }
}

function createCert(eventname, start, end, name, ceu, eventid) {
  const doc = new PDFDocument({
    margins: {
      top: 30,
      bottom: 30,
      left: 30,
      right: 30
    },
    layout: "landscape",
    size: "A4",
  });
  const stream = doc.pipe(blobStream());
  // do content
  //get header image in arraybuffer
  var logo = null;
  dorequest("/common/Uploaded%20files/Code/PDF/Header.png", function(r){
    logo = r;
  }, null, "arraybuffer");
  postMessage({type: "progress", data: 4,});
  //do rest
  if (logo == null) {
    certlog("Image Error.");
    return null;
  }
  doc.image(logo, 0, 30, {fit:[841.89, 90], align: 'center', valign: 'center'});
  var normsize = 22;
  var itemsize = 34;
  var eventsize = 30;
  var spacing = 0.8;
  doc.fontSize(normsize); doc.font('Times-Roman').text('').moveDown(2);
  doc.font('Times-Roman').text('Certificate of Attendence', {align: 'center'});
  doc.fontSize(normsize); doc.font('Times-Roman').text('').moveDown(spacing);

  doc.fontSize(itemsize); doc.font('Times-Roman').text(name, {align: 'center'});
  doc.fontSize(normsize); doc.font('Times-Roman').text('').moveDown(spacing);

  doc.fontSize(normsize); doc.font('Times-Roman').text('attended', {align: 'center'});
  doc.fontSize(normsize); doc.font('Times-Roman').text('').moveDown(spacing);

  doc.fontSize(eventsize); doc.font('Times-Roman').text(eventname, {align: 'center'});
  doc.fontSize(normsize); doc.font('Times-Roman').text('').moveDown(spacing);

  doc.fontSize(normsize); doc.font('Times-Roman').text('on', {align: 'center'});
  doc.fontSize(normsize); doc.font('Times-Roman').text('').moveDown(spacing);

  edate = formatDate(start, end);
  doc.fontSize(itemsize); doc.font('Times-Roman').text(edate, {align: 'center'})
  doc.fontSize(normsize); doc.font('Times-Roman').text('').moveDown(spacing);

  doc.fontSize(normsize); doc.font('Times-Roman').text('of {0} hours duration'.format(ceu), {align: 'center'})

  var blob = null;
  stream.on('finish', function() {
  // get a blob you can do whatever you like with
    blob = stream.toBlob('application/pdf');
    // send back to main thread.
    postMessage({
      type: "MakeCert",
      data: [blob, slugify(eventid), slugify(name)],
    });
    postMessage({type: "progress", data: 6,});
  });
  // Get blob
  doc.end();
  postMessage({type: "progress", data: 5,});
  return;
}


function certlog(s) {
  postMessage({
    type: "certlog",
    data: s,
  });
}

function dorequest(url, func, errfunc = null, type=null) {
  var xhr = new XMLHttpRequest();
  if (type != null) { xhr.responseType = type; }
  xhr.open('GET', url, false); // NO ASYNC because I'm not good.
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.setRequestHeader('RequestVerificationToken', TOKEN);
  xhr.onload = function() {
    if (xhr.status === 200) {
      if (type == null) { func(JSON.parse(xhr.responseText)); }
      else { func(xhr.response); }
    }
    else {
      if (errfunc) { errfunc(xhr.responseText); }
      else { certlog("Request error."); console.log("Request error ({0}). {1}".format(url, xhr.responseText)); }
    }
  };
  xhr.send();
}

function startProcess(eventid, userid, prodcode) {
  // Steps to genrate PDF
  // Get Event date(s) and title
  var start = null;
  var end = null;
  var name = null;
  var eventname = null;
  // Get user registration for hours
  var orderid = null;
  dorequest("/api/EventRegistration/{0}-{1}".format(eventid, userid),
    function(regdata) {
      if (regdata["AdditionalAttributes"] && regdata["AdditionalAttributes"]["$values"]) {
        regdata["AdditionalAttributes"]["$values"].forEach(function(data){
          if (data["Name"] == "AssociatedInvoiceId") { orderid = data["Value"]; }
        });
      }
      if (orderid == null) {
        certlog("Invalid data(oid).");
        return;
      }
      if (regdata["Registrant"] && regdata["Registrant"]["PersonName"]) {
        name = "{0} {1}".format(regdata["Registrant"]["PersonName"]["FirstName"],
          regdata["Registrant"]["PersonName"]["LastName"]);
      } else { certlog("Unknown person."); }
  });
  postMessage({type: "progress", data: 1});
  console.log(orderid);
  if (orderid == null || name == null) {
    return;
  }
  var ceu = null;
  // get custom title and date data first from function then event...
  dorequest("/api/query?QueryName=$/ACHPERVIC/Events/Event Certificate CEU&PRODUCT_CODE={0}&ORDER_NUMBER={1}".format(prodcode, orderid),
    function(funcdata) {
      var item = funcdata["Items"]["$values"][0];
      ceu = item["CEU_AWARDED"];
      eventname = item["Title"];
      start = item["BeginDate"];
      end = item["EndDate"];
  });
  postMessage({type: "progress", data: 2});
  if (start == null || end == null) {
    dorequest("/api/Event/{0}".format(eventid),
      function(eventdata) {
        if (start == null) {start = eventdata["StartDateTime"]; }
        if (end == null) { end = eventdata["EndDateTime"]; }
    });
  }
  postMessage({type: "progress", data: 3,});
  if (start == null || end == null || eventname == null) {
    certlog("Invalid event data(dt).");
    return;
  }
  if (ceu == null) {
    certlog("No data(ce).");
    return;
  }
  createCert(eventname, start, end, name, ceu, prodcode);
}

function slugify(text, separator="-") {
    text = text.toString().toLowerCase().trim();

    const sets = [
        {to: 'a', from: '[ÀÁÂÃÄÅÆĀĂĄẠẢẤẦẨẪẬẮẰẲẴẶ]'},
        {to: 'c', from: '[ÇĆĈČ]'},
        {to: 'd', from: '[ÐĎĐÞ]'},
        {to: 'e', from: '[ÈÉÊËĒĔĖĘĚẸẺẼẾỀỂỄỆ]'},
        {to: 'g', from: '[ĜĞĢǴ]'},
        {to: 'h', from: '[ĤḦ]'},
        {to: 'i', from: '[ÌÍÎÏĨĪĮİỈỊ]'},
        {to: 'j', from: '[Ĵ]'},
        {to: 'ij', from: '[Ĳ]'},
        {to: 'k', from: '[Ķ]'},
        {to: 'l', from: '[ĹĻĽŁ]'},
        {to: 'm', from: '[Ḿ]'},
        {to: 'n', from: '[ÑŃŅŇ]'},
        {to: 'o', from: '[ÒÓÔÕÖØŌŎŐỌỎỐỒỔỖỘỚỜỞỠỢǪǬƠ]'},
        {to: 'oe', from: '[Œ]'},
        {to: 'p', from: '[ṕ]'},
        {to: 'r', from: '[ŔŖŘ]'},
        {to: 's', from: '[ßŚŜŞŠ]'},
        {to: 't', from: '[ŢŤ]'},
        {to: 'u', from: '[ÙÚÛÜŨŪŬŮŰŲỤỦỨỪỬỮỰƯ]'},
        {to: 'w', from: '[ẂŴẀẄ]'},
        {to: 'x', from: '[ẍ]'},
        {to: 'y', from: '[ÝŶŸỲỴỶỸ]'},
        {to: 'z', from: '[ŹŻŽ]'},
        {to: '-', from: '[·/_,:;\']'}
    ];

    sets.forEach(set => {
        text = text.replace(new RegExp(set.from,'gi'), set.to);
    });

    text = text.toString().toLowerCase()
        .replace(/\s+/g, '-')         // Replace spaces with -
        .replace(/&/g, '-and-')       // Replace & with 'and'
        .replace(/[^\w\-]+/g, '')     // Remove all non-word chars
        .replace(/\--+/g, '-')        // Replace multiple - with single -
        .replace(/^-+/, '')           // Trim - from start of text
        .replace(/-+$/, '');          // Trim - from end of text

    if ((typeof separator !== 'undefined') && (separator !== '-')) {
        text = text.replace(/-/g, separator);
    }

    return text;
}
