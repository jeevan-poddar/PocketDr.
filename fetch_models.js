const https = require("https");
https.get("https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyBEESp-ixCepjx_yCLmhFTP-3ebEXCJrYA", (resp) => {
  let data = "";
  resp.on("data", chunk => data += chunk);
  resp.on("end", () => {
    const json = JSON.parse(data);
    if(json.models) {
      console.log(json.models.filter(m => m.supportedGenerationMethods?.includes("generateContent")).map(m => m.name.replace("models/", "")));
    } else {
      console.log(json);
    }
  });
});
