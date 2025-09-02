async function postJSON(url, body){
  const res = await fetch(url, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify(body)
  });
  if(!res.ok) throw new Error(await res.text());
  return res.json();
}
async function getJSON(url){
  const res = await fetch(url);
  if(!res.ok) throw new Error(await res.text());
  return res.json();
}

const el = id => document.getElementById(id);
const product  = el('product');
const audience = el('audience');
const goal     = el('goal');
const tone     = el('tone');
const visual   = el('visual');
const cta      = el('cta');
const ratio    = el('ratio');      // expects values like "9:16", "16:9", "1:1"
const duration = el('duration');   // "5" | "10"
const model    = el('model');
const refimg   = el('refimg');
// Map UI aspect ratios to Runway's required pixel sizes
const RATIO_TO_SIZE = {
  '16:9': '1280:720',
  '9:16': '720:1280',
  '1:1':  '1024:1024'
};
const btnScript = el('btnScript');
const btnTTS    = el('btnTTS');
const btnVideo  = el('btnVideo');

const preview  = el('preview');
const scriptBox= el('script');
const voice    = el('voice');
const audio    = el('audio');
const dlAudio  = el('dlAudio');
const video    = el('video');
const status   = el('status');
const debugLog = document.getElementById('debugLog'); // <pre> we added in HTML

function buildPrompt(){
  const p = product.value.trim()  || '(product?)';
  const a = audience.value.trim() || '(audience?)';
  const g = goal.value.trim()     || '(goal?)';
  const t = tone.value.trim()     || 'energetic, clean, high-contrast, fast cuts';
  const v = visual.value.trim()   || '';
  const c = cta.value.trim()      || 'Shop now';

  return `Create a ${duration.value}s vertical ad for ${p}. Audience: ${a}. Goal: ${g}.
Style: ${t}. Visual notes: ${v}. Include a clear on-screen call to action: "${c}". 
Use dynamic camera moves and product hero shots. Keep it brand-safe.`;
}

function buildScriptPrompt(){
  return `You are a performance ad copywriter. Write a ${duration.value}s voiceover script for a video ad.
Product/offer: ${product.value || '(not provided)'}
Audience: ${audience.value || '(not provided)'}
Goal: ${goal.value || '(not provided)'}
Tone: ${tone.value || 'energetic, clean'}
CTA: ${cta.value || 'Shop now'}

Requirements:
- 2–3 short punchy lines, total ${duration.value==='5'?'25-35':'45-65'} words max.
- Plain language, no jargon.
- End with the CTA verbatim.
Return only the script text.`;
}

function lockUI(locked){
  [btnScript, btnTTS, btnVideo].forEach(b=>b.disabled = locked);
}

function toast(msg){ status.textContent = msg; }
function logDebug(label, obj){
  if(!debugLog) return;
  const line = `${label}\n${JSON.stringify(obj, null, 2)}\n`;
  // replace if first write, append otherwise
  debugLog.textContent = debugLog.textContent ? (debugLog.textContent + '\n' + line) : line;
}

// Step 1: Generate Script
btnScript.addEventListener('click', async ()=>{
  try{
    lockUI(true);
    preview.value = buildPrompt() + "\n\n---\nVOICEOVER REQUEST\n" + buildScriptPrompt();
    toast("Generating script...");
    const data = await postJSON('/api/script', { prompt: buildScriptPrompt() });
    scriptBox.value = data.script;
    btnTTS.disabled = false;
    toast("Script ready.");
  }catch(e){
    console.error(e); toast("Script failed: " + e.message);
  }finally{ lockUI(false); }
});

// Step 2: TTS
btnTTS.addEventListener('click', async ()=>{
  try{
    lockUI(true);
    toast("Generating voiceover (MP3)...");
    const data = await postJSON('/api/tts', { text: scriptBox.value, voice: voice.value });
    const b64 = data.base64; const mime = data.mime || 'audio/mpeg';
    const src = `data:${mime};base64,${b64}`;
    audio.src = src; audio.style.display='block';
    dlAudio.href = src; dlAudio.style.display='inline-block';
    toast("Voiceover ready.");
  }catch(e){
    console.error(e); toast("TTS failed: " + e.message);
  }finally{ lockUI(false); }
});

// Step 3: Video (text->image->video)
btnVideo.addEventListener('click', async ()=>{
  try{
    lockUI(true);
    // clear previous debug
    if (debugLog) debugLog.textContent = '';

    const promptText = buildPrompt();
    preview.value = promptText;

    // Use provided ref image or synthesize from text
    let promptImage = refimg.value.trim();
    if(!promptImage){
      toast("Generating first frame (image)...");
      const payloadTI = { promptText, ratio: ratio.value }; // ratio like "9:16"
      logDebug('POST /api/runway/text_to_image payload', payloadTI);
      const img = await postJSON('/api/runway/text_to_image', payloadTI);
      promptImage = img.imageUrl;
      logDebug('text_to_image response', img);
    }

    toast("Starting video generation...");
    const payloadV = {
      promptImage,
      promptText,
      ratio: ratio.value,                           // "9:16" | "16:9" | "1:1"
      duration: parseInt(duration.value,10),        // 5 | 10
      model: model.value                            // "gen3_alpha" | "gen3_alpha_turbo" | "gen4_turbo"
    };
    logDebug('POST /api/runway/image_to_video payload', payloadV);

    const start = await postJSON('/api/runway/image_to_video', payloadV);
    const taskId = start.taskId;
    logDebug('image_to_video start response', start);

    toast("Rendering video… this can take 60–120s. Please keep this tab open.");

    // poll
    let done = false;
    while(!done){
      await new Promise(r=>setTimeout(r, 5000 + Math.random()*1000));
      const s = await getJSON('/api/runway/task?id=' + encodeURIComponent(taskId));
      logDebug('task poll', s);

      if(s.status === 'SUCCEEDED' && s.output && s.output.length){
        video.src = s.output[0];
        video.style.display='block';
        toast("Video ready.");
        done = true;
      }else if(s.status === 'FAILED' || s.status === 'CANCELED'){
        throw new Error("Task " + s.status);
      }else{
        console.log("Status:", s.status);
      }
    }
  }catch(e){
    console.error(e);
    toast("Video failed: " + e.message);
  }finally{
    lockUI(false);
  }
});

// Enable video button after any brief change (so user can run it directly)
[product,audience,goal,tone,visual,cta,ratio,duration,model,refimg].forEach(i=>{
  i.addEventListener('input', ()=>{ btnVideo.disabled = false; });
});

// init
btnVideo.disabled = false;
