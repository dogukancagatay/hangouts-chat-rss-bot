// URLs of the RSS feeds to parse
var RSS_FEED_URLS = [
  "https://cloudblog.withgoogle.com/products/gcp/rss/",
];

// Webhook URL of the Hangouts Chat room
var WEBHOOK_URL = "https://chat.googleapis.com/v1/spaces/[SPACE_ID]/messages?key=[KEY]";

// When DEBUG is set to true, the topic is not actually posted to the room
var DEBUG = false;

function processFeeds() {
  RSS_FEED_URLS.forEach(function(url) {
    fetchNews_(url)
  });
}

function fetchNews_(url) {

  var url_b64 = Utilities.base64Encode(url, Utilities.Charset.UTF_8);
  var lastUpdate = new Date(parseFloat(PropertiesService.getScriptProperties().getProperty(url_b64 + "_lastUpdate")) || 0);

  Logger.log("Last update: " + lastUpdate);
  Logger.log("Fetching '" + url + "'...");


  var response = UrlFetchApp.fetch(url);
  var content_type = response.getAllHeaders()["Content-Type"];
  var xml_str = response.getContentText();

  var count = 0;
  var items;

  if (content_type.startsWith("application/atom+xml")) {
    items = parseAtom_(xml_str);
  } else if (content_type.startsWith("application/xml") || content_type.startsWith("application/rss+xml")) {
    items = parseRSS_(xml_str);
  } else {
    Logger.log("Cannot parse Content-Type:" + content_type);
    return;
  }

  items.forEach(function(it) {

    if(it.pubDate.getTime() > lastUpdate.getTime()) {
      Logger.log("Posting topic '"+ it.title +"'...");

      if(!DEBUG){
        postTopic_(it.title, it.description, it.link);
      }

      PropertiesService.getScriptProperties().setProperty(url_b64 + "_lastUpdate", it.pubDate.getTime());
      count++;
    }

  });

  Logger.log("> " + count + " new(s) posted");
}

function parseAtom_(xml_str) {
  var atom = XmlService.getNamespace("http://www.w3.org/2005/Atom");
  var document = XmlService.parse(xml_str);

  var root = document.getRootElement();
  var last_build_date = root.getChild("updated", atom).getText();
  var items = root.getChildren("entry", atom).reverse();

  return items.map(function(it) {

    var pubDate;
    if (it.getChild("updated", atom)) {
      pubDate = new Date(it.getChild("updated", atom).getText());
    } else {
      pubDate = new Date(last_build_date);
    }

    var title = it.getChild("title", atom).getText();
    var link = it.getChild("link", atom).getAttribute("href").getValue();

    var description;
    if (it.getChild("content", atom)) {
      description = it.getChild("content", atom).getText();
    } else {
      description = "";
    }

    if(DEBUG){
      Logger.log("------ " + (i+1) + "/" + items.length + " ------");
      Logger.log(pubDate);
      Logger.log(title);
      Logger.log(link);
      // Logger.log(description);
      Logger.log("--------------------");
    }

    return {
      pubDate: pubDate,
      title: title,
      description: description,
      link: link,
    };

  });
}

function parseRSS_(xml_str) {
  var document = XmlService.parse(xml_str);

  var channel = document.getRootElement().getChild("channel")
  var last_build_date = channel.getChild("lastBuildDate").getText()
  var items = channel.getChildren('item').reverse();

  Logger.log(items.length + " entrie(s) found");

  return items.map(function (it) {

    var pubDate;
    if (it.getChild('pubDate')) {
      pubDate = new Date(it.getChild('pubDate').getText());
    } else {
      pubDate = new Date(last_build_date);
    }

    var title = it.getChild("title").getText();
    var link = it.getChild("link").getText();

    var description;
    if (it.getChild("og") && it.getChild("og").getChild("description")) {
      description = it.getChild("og").getChild("description").getText();
    } else if (it.getChild("description")) {
      description = it.getChild("description").getText();
    } else {
      description = "";
    }

    if(DEBUG){
      Logger.log("------ " + (i+1) + "/" + items.length + " ------");
      Logger.log(pubDate);
      Logger.log(title);
      Logger.log(link);
      // Logger.log(description);
      Logger.log("--------------------");
    }

    return {
      pubDate: pubDate,
      title: title,
      description: description,
      link: link,
    };

  });
}

function postTopic_(title, description, link) {

  var text = "*" + title + "*" + "\n";

  //if (description){
  //  text += description.substring(0, 1000) + "...\n";
  //}

  text += link;

  var options = {
    'method' : 'post',
    'contentType': 'application/json',
    'payload' : JSON.stringify({
      "text": text
    })
  };

  UrlFetchApp.fetch(WEBHOOK_URL, options);
}
