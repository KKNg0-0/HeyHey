// https://deno.land/std@0.194.0/http/server.ts?s=serve

import { serve } from "http/server.ts";
// https://deno.land/std@0.194.0/http/file_server.ts?s=serveDir
import { serveDir } from "http/file_server.ts";
import "https://deno.land/std@0.203.0/dotenv/mod.ts";

const waitingList = new Map();  
const clientsMap = new Map();   // all clients
const userDataMap = new Map(); // 名前と出来事を記録するマップ
 /**
 * APIリクエストを処理する
 */
Deno.serve({
  port: 8080,
  
  handler: async (req) => {
    if (req.headers.get("upgrade") === "websocket") {
      const { socket, response } = Deno.upgradeWebSocket(req);

      socket.onopen = () => {
        // 接続したときの処理
        console.log("CONNECTED");
        socket.send(JSON.stringify({
          event: "connected",
        }));
      };
      socket.onmessage = async (message) => {
        const data = JSON.parse(message.data);
        // 受信したときの処理
        switch (data.event) {
          // 送ってきた“もの”のイベント類
          case "matching-request": 
            clientsMap.set(data.myName, socket);
            userDataMap.set("myName", data.myName); // 自分の名前、相手の名前、相手のできごとを保存
            userDataMap.set("pairName", data.pairName);
            userDataMap.set("pairActive", data.pairActive);
            console.log(data.pairName, data.pairActive);
            console.log(`matching-request received! user-data: ${data.myName},${data.pairName},${data.pairActive}`);
            const previousName = waitingList.get(data.pairName);  // get previous user's name

            if((previousName != null) && (previousName === data.myName)){
              // マッチングに成功した時の処理
              const username = userDataMap.get("myName"); // mapからデータを取り出す
              const pairname = userDataMap.get("pairName")
              nowDate = new Date(); // 今の時間を変数に入れる
              const kv = getkvData(); // databaseを開く
              const key = ["user-name", username, "history", nowDate];  // key
              const value = {   // value
              myName: username,
              pairName: pairname,
              timeStamp: nowDate
              };
              kv.set(key, value); // data set


              const json = JSON.stringify({event: "matching-success", pairName: data.pairName, pairActive: data.pairActive});
              const clientA = clientsMap.get(data.myName);
              clientA.send(json);
              const clientB = clientsMap.get(data.pairName);
              clientB.send(json);
            }else{
              // マッチング待ちの時の処理
              waitingList.set(data.myName, data.pairName);
              const json = JSON.stringify({event: "send-success"});
              socket.send(json);
            }
            break;

          default:
            break;
        }
      };
      socket.onclose = () => console.log("DISCONNECTED"); // 接続が終わったときの処理
      
      socket.onerror = (error) => console.error("ERROR:", error); // エラーが発生したときの処理

      return response;
  
    }else{
      const pathname = new URL(req.url).pathname;
      console.log(pathname);

      if(req.method == "POST" && pathname === "/activity"){
        // アクティビティの保存処理
        const dbClient = await getkvData();
        console.log(dbClient);

        const dateNow = new Date();
        const timeNow = dateNow.toISOString();

        const json = await req.json();
        const username = json["user_name"];
        const activity = json["activity"];
        // pngをjpegに変えること
        const image = json["image"];

        await saveAll(dbClient, username, activity, image, timeNow);
      }


      if(req.method == "POST" && pathname === "/history"){
        console.log("aaa")
        // アクティビティの保存処理aaaaa
        const dbClient = await getkvData();
        console.log(dbClient);

        const dateNow = new Date();
        const timeNow = dateNow.toISOString();

        const json = await req.json();
        const username = json["username"];
        const pairname = json["pairname"];
        const pairactive = json["pairactive"];
        // pngをjpegに変えること

        const result = await saveMatchAll(dbClient, username, pairname, pairactive, timeNow);
        return new Response(await result);
      }

      if(req.method == "GET" && pathname === "/image"){
        // マッチ画面で相手の画像を返す処理
        const json = await req.json();  // JSONのデータを受け取る
        const pairName = json["pair_name"]; // ペアした人の名前、活動をGet
        const pairAct = json["pair_act"];

        const kv = await getkvData(); // Databaseを開く

        const imageGet = await getActivityImage(kv, pairName, pairAct);
        console.log(imageGet.value.img);
        return new Response(JSON.stringify({
          image: imageGet.value.img,
          })
        );
      }

      // publicフォルダ内にあるファイルを返す
      return serveDir(req, {

        fsRoot: "public",
        urlRoot: "",
        showDirListing: true,
        enableCors: true,
      });
    }
  }
});

async function getkvData(){//denokvをオープンする関数
  return await Deno.openKv(Deno.env.get("URL"));
}

async function saveAll(kv, username, activity, image, time){
  await kv.set(
    ["username", username, "activity", activity, "image"],
    {
        img: image,
        time: time
    }
  );
}

function saveMatchAll(kv, username, pairname, pairactive, time){
  console.log(kv);
  return kv.set(
    ["username", username, "history","time", time],
    {   //value
      pairName: pairname,
      pairActive:pairactive,
      time: time
      }
  );
}

async function getActivityImage(kv, username, activity){
  const actGet = await kv.get(["username", username, "activity", activity, "image"]);
  return actGet;
}