const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI("AIzaSyBEESp-ixCepjx_yCLmhFTP-3ebEXCJrYA");
const AIVA_SYSTEM_PROMPT = "# IDENTITY & PURPOSE\nYou are Aiva.";

async function run() {
  const models = ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-pro-latest", "gemini-flash-latest"];
  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: AIVA_SYSTEM_PROMPT
      });
      const chat = model.startChat({ history: [] });
      const result = await chat.sendMessage("hello");
      console.log(`Success with ${modelName}`);
    } catch (err) {
      console.error(`Failed ${modelName}:`, err.message);
    }
  }
}
run();
