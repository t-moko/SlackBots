function doPost(e) {
  // プロジェクトのプロパティ>スクリプトのプロパティから情報取得
  // Bot User OAuth Access TokenとAppのVerification TokenとワークスペースのURL（固有部分）が入っている前提
  const prop = PropertiesService.getScriptProperties();
  
  // Events APIからのPOSTを取得
  // 参考→https://api.slack.com/events-api
  const json = JSON.parse(e.postData.getDataAsString());
  
  // Events APIからのPOSTであることを確認
  if (prop.getProperty("verify_token") != json.token) {
    throw new Error("invalid token.");
  }
  
  // Events APIを使用する初回、サーバの存在確認？みたいなのがあるので、そのための記述
  if (json.type == "url_verification") {
    return ContentService.createTextOutput(json.challenge);
  }  
  
  // 参考→https://api.slack.com/events/message.channels
  const token = prop.getProperty("bot_token"); // Bot User OAuth Access Token （xoxbから始まるもの）を取得
  const workspace = prop.getProperty("workspace"); // ワークスペースのURLの固有部分（hoge.slack.comのhoge部分）を取得
  const event_type = json.event.type;
  const channel = json.event.channel;
  const text = json.event.text;
  const ts = json.event.ts;
  
  // 記録先スプレッドシートの取得
  // スプレッドシートを先に作って、ツール>スクリプトエディタからこのスクリプトを使う前提
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  let lastrow = sheet.getLastRow();
  
  // メッセージの転送
  const response = forwardMessage(token, workspace, event_type, channel, text, ts);
  
  // メッセージの転送ができたときに、転送済の証としてリアクションをする＆スプレッドシートに記録する
  if (response.ok == true) {
    addReaction(token, channel, ts);
    recordHistory(sheet, lastrow, ts, response.message.text, text);
  }
}


function forwardMessage(token, workspace, event_type, channel, text, ts) {
  // 参考→https://api.slack.com/methods/chat.postMessage
  const forward_url = "https://slack.com/api/chat.postMessage";
  const channels = {
    // 転送する条件となるワードと、転送先のチャンネルIDをkey value形式で代入
    "foo": "fooが書かれていた時に転送するチャンネルのID",
    "bar" : "barが書かれていた時に転送するチャンネルのID",
    "Other" :"fooとbar以外が書かれていた時に転送するチャンネルのID"
  };
  const keys = Object.keys(channels);
  const trigger_word = "hoge"; // 転送するトリガーワード
  
  if (event_type == "message" && text.indexOf(trigger_word) != -1) {
    const link = "https://"+workspace+".slack.com/archives/"+channel+"/p"+ts.replace(".", "");
    
    let payload = {
      "token" : token,
      "text" : link
    };
    
    for(let key in channels) {
      if(text.indexOf(key+trigger_word) != -1 || key == keys[keys.length-1]) {
        // 最後はその他が入ることを想定（trigger_wordは含まれているが他のkeyと一致するワードが入っていない場合にその他に指定したチャンネルに転送する）
        // もしその他は考えない場合は条件式の || 以降を削除
        payload.channel = channels[key];
        break;
      }
    }
    
    var params = {
      "method" : "post",
      "payload" : payload
    };
    
    const r = UrlFetchApp.fetch(forward_url, params);
    const response = JSON.parse(r);
    
    return response;
  }
  return null;
}


function addReaction(token, channel, ts) {
  // 参考→https://api.slack.com/methods/reactions.add
  // リアクションはチャンネルにいるユーザしかできないようなので、
  // 予めチャンネルにアプリ（bot）を追加しておく必要がある
  const reaction_url = "https://slack.com/api/reactions.add";
  const emoji_name = "heavy_check_mark"; // リアクションに使う絵文字名を英語で入力
  
  let payload = {
    "token" : token,
    "channel" : channel,
    "name" : emoji_name,
    "timestamp" : ts
  };
  
  var params = {
    "method" : "post",
    "payload" : payload
  };
  
  UrlFetchApp.fetch(reaction_url, params);
}


function recordHistory(sheet, lastrow, ts, link, text) {
  // 今回はスプレッドシートの1列目にタイムスタンプ、2列目に転送したメッセージのリンク、3列目に転送したメッセージの内容を保存
  sheet.getRange(lastrow+1,1).setValue(ts);
  sheet.getRange(lastrow+1,2).setValue(link.replace("<","").replace(">",""));
  sheet.getRange(lastrow+1,3).setValue(text);
}