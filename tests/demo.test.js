// Drives demo.js through a DOM shim: reviews, mistakes, menus, import/export, settings.
//
// The shim does not parse innerHTML — a rewritten container is just a new object, and the old
// one keeps its stale markup. Anything asserted about rendered markup therefore reads innerHTML
// as text. Compound class selectors like `.sheet.open` are resolved against a registry of every
// element the demo has touched, because the demo asks for them to find the sheet that is open.
const timers=[];let fails=0;const ALL=[];
const ok=(c,m)=>{console.log((c?"PASS ":"FAIL ")+m);if(!c)fails++};
function mk(){const o={style:{setProperty(){}},_h:{},_s:{},children:[],hidden:false,innerHTML:"",value:"",dataset:{},
 classList:{toggle(c){this[c]=!this[c]},add(c){this[c]=true},remove(c){delete this[c]},contains(c){return !!this[c]}},addEventListener(t,f){let a=o._h[t];if(!a){a=[];o._h[t]=a;}a.push(f)},append(c){o.children.push(c)},appendChild(c){o.children.push(c)},remove(){},
 setPointerCapture(){},setAttribute(){},getAttribute(){return null},focus(){},getBoundingClientRect:()=>({left:0,top:0,width:560,height:560}),querySelectorAll:()=>[],
 querySelector(s){
  if(/^\.[\w-]+(\.[\w-]+)+$/.test(s)){const parts=s.split(".").slice(1);for(let i=ALL.length-1;i>=0;i--)if(parts.every(p=>ALL[i].classList[p]))return ALL[i];return undefined}
  if(!o._s[s])o._s[s]=mk();return o._s[s];},
 get textContent(){return this._tc ?? ""},set textContent(v){this._tc = String(v)}};ALL.push(o);return o}
const host=mk(),body={tagName:"BODY"},htmlRoot={dataset:{},style:{setProperty(){}},classList:{toggle(){}}};
// The real generated design inputs and the real rules engine, so the unit tests exercise the
// same SAN and figurine data the browser gets rather than a stubbed approximation.
global.window=global;
global.Chess=require("chess.js").Chess;
global.SRSEngine=require("../engine.js");
require("../assets/figurines.js");
global.PIECE_VIEWBOX="5 2 90 90";global.PIECE_DEFS="";
global.document={getElementById:()=>host,createElementNS:()=>mk(),createElement:()=>mk(),documentElement:htmlRoot,activeElement:body,body,createRange:()=>({selectNodeContents(){}}),addEventListener(t,f){let h=global._docH;if(!h){h={};global._docH=h;}h[t]=f},querySelectorAll:()=>[],querySelector(s){return host.querySelector(s)}};
global.getSelection=()=>({removeAllRanges(){},addRange(){}});global.navigator={clipboard:{writeText:()=>Promise.resolve()}};
const keys=[];global.addEventListener=(t,f)=>t==="keydown"&&keys.push(f);
global.setTimeout=f=>{timers.push(f);return timers.length};global.clearTimeout=()=>{};
const flush=()=>{let n=0;while(timers.length&&n++<800)timers.shift()()};
require("../demo.js");
const q=s=>host.querySelector(s),bd=q("#bd"),F="abcdefgh";
// demo.js asks the DOM for `.sheet.open` to find the open sheet, so those two containers need the
// class the shell markup gives them. The shim does not parse innerHTML, so seed them here.
q("#sheetScope").classList.add("sheet");q("#sheetLib").classList.add("sheet");
const click=(a,d={})=>host._h.click[0]({target:{closest:()=>({dataset:{a,...d}})}});
const key=(k,x={})=>keys.forEach(f=>{f({key:k,target:body,preventDefault(){},...x});});
const xy=(s,flip)=>{let c=F.indexOf(s[0]),r=8-s[1];if(flip){c=7-c;r=7-r}return{clientX:(c+.5)*560/8,clientY:(r+.5)*560/8,pointerId:1}};
const mv=(m,flip)=>{for(const s of [m.slice(0,2),m.slice(2,4)]){bd._h.pointerdown[0](xy(s,flip));bd._h.pointerup[0](xy(s,flip))}flush()};
const E=SRSEngine,U=s=>E.compile(s);
const L1=U("e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6 a3 c4 Nbd2"),L2=U("e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Bd7 Be2 Nge7 Na3 cxd4 cxd4 Nf5 Nc2"),L3=U("e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e5 Nb3 Be6");
flush();
ok(q("#scopeName").textContent==="Queen Pawn Repertoire"&&/16/.test(q("#due").innerHTML),"initial: study + 16 due");
mv(L1[0]);ok(q("#turnTxt").textContent==="White to play"&&/^Correct\./.test(q("#live").textContent),"first move remembered, turn row untouched");
ok(/15/.test(q("#due").innerHTML),"due count drops to 15");
// wrong move -> reveal, then correct -> Continue
mv("a2a3");ok(q("#answer").hidden===false&&q("#ansMove").innerHTML.includes("d4"),"wrong move reveals the expected move in SAN ("+q("#ansMove").innerHTML+")");
ok(/15/.test(q("#due").innerHTML),"missed card stays due");
mv(L1[2]);ok(q("#contBtn").hidden===false&&q("#skipBtn").hidden===true,"Continue shown after playing the revealed move");
key(" ");flush();ok(q("#contBtn").hidden===true,"Space advances");
// skip reveals
key("s");ok(q("#answer").hidden===false,"S key skips and reveals");mv(L1[4]);click("cont");flush();
// finish the rest of line 1 (cards k=6,8,10,12), missed cards come back at the end
for(const k of [6,8,10,12]){mv(L1[k]);}flush();
ok(q("#ctx").textContent==="Game 2","moves on through line ("+q("#ctx").textContent+")");
// line 2 in order, then the two re-queued misses from line 1 (k=2 wrong move, k=4 skipped)
for(let k=0;k<L2.length;k+=2)mv(L2[k]);
ok(q("#ctx").textContent==="Game 1"&&/>2</.test(q("#due").innerHTML),"misses came back at the end (2 due)");
mv(L1[2]);mv(L1[4]);flush();
ok(q(".view-idle").hidden===false&&q(".idle").innerHTML.includes("Nothing due."),"queue empties -> Nothing due.");
ok(/Next review/.test(q(".idle").innerHTML),"empty state shows next review");
// practice
click("practice");flush();ok(q("#due").innerHTML.includes("Practice"),"practice mode label");click("practice");flush();ok(q(".view-idle").hidden===false,"ending practice returns to empty");
// switch study, play black
click("picker");ok(q("#sheetScope").classList.contains("open")&&q("#scopeList").innerHTML.includes("Sicilian Defense Repertoire"),"picker lists studies");
click("pick",{i:"1"});flush();ok(q("#scopeName").textContent==="Sicilian Defense Repertoire"&&/>7</.test(q("#due").innerHTML),"picked Sicilian: 7 due");
for(let k=1;k<L3.length;k+=2)mv(L3[k],true);flush();ok(q(".idle").innerHTML.includes("Nothing due."),"black study completes");

// keyboard-only play: focus the board, arrow to the pawn, Enter to select, arrow to the target, Enter to move.
// Study 0's schedule is exhausted by this point, and the app has no "start over" — so practice mode
// is the way to get a populated board, which is also the path a real visitor takes.
click("pick",{i:"0"});click("practice");flush();
const bk=(k)=>bd._h.keydown[0]({key:k,preventDefault(){}});
bd._h.focus[0]();bk("Enter");ok(/selected/.test(q("#live").textContent),"keyboard: Enter selects the pawn on e2 ("+q("#live").textContent+")");
bk("ArrowUp");bk("ArrowUp");bk("Enter");ok(/^Correct\./.test(q("#live").textContent),"keyboard: moved e2-e4 with arrows + Enter");flush();
bd._h.blur[0]();click("pick",{i:"1"});flush();
// Library sheet (overflow button) carries only Settings and About
// Library sheet (overflow button) carries only Settings and About
const lib = () => q("#sheetLib .list").innerHTML;
click("more");ok(q("#sheetLib").classList.contains("open")&&lib().includes("Settings")&&lib().includes("About and licences"),"library sheet has Preferences rows");click("close");flush();

// Study actions are reached from the scope list's options button
const acts = () => q("#sheetScope .list").innerHTML;
click("picker");click("sacts",{i:"1"});flush();ok(q("#sheetScope").classList.contains("open")&&acts().includes("Analyze")&&acts().includes("Export PGN")&&acts().includes("Practice"),"study actions sheet has real entries");
// Analyze renders into the settings shell, so it must leave #settingsBody and #backBtn in place —
// overwriting the section used to detach the back button's listener and break every later screen.
click("analyze");click("ply",{i:"3"});click("anext");click("aprev");ok(q(".view-settings").hidden===false&&q("#setTitle").textContent==="Game 1"&&q("#settingsBody").innerHTML.includes("Nxd4"),"analysis view lists moves");ok(q("#settingsBody").innerHTML.includes('class="ply on"'),"analysis view marks the current ply");click("aback");flush();

// export from the study actions sheet
click("picker");click("sacts",{i:"1"});flush();click("export");ok(q(".view-settings").hidden===false&&q("#settingsBody").innerHTML.includes("Sicilian Defense Repertoire"),"export shows PGN");click("copy",{});
// Escape dismisses an open sheet (prototype.js: `if(e.key==='Escape'){ closeSheets(); return; }`),
// which is what the key is for — a pushed screen has its own back button, not a dismiss key.
click("picker");ok(q("#scrim").classList.contains("open"),"picker raises the scrim");key("Escape");ok(!q("#scrim").classList.contains("open"),"Escape closes sheet");
// import: success, error, lichess
click("import");q("#i-pgn").value=`[Event "My Rep for White"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d4 exd4 6. cxd4 Bb4+ 7. Nc3 Nxe4 8. O-O Bxc3 9. d5 Bf6 10. Re1 Ne7 *`;q("#i-title").value="";
click("doimport");flush();ok(q("#scopeName").textContent==="My Rep for White"&&/10/.test(q("#due").innerHTML)&&q(".view-settings").hidden===true,"import succeeds: 10 due");
click("import");q("#i-pgn").value="1. e4 e5 2. Qh8";click("doimport");ok(/Import failed: could not read the move/.test(q("#i-err").textContent),"bad PGN shows error");
click("isrc",{v:"lichess"});click("doimport");ok(/can't reach Lichess/.test(q("#i-err").textContent),"Lichess tab explains the limit");click("close");
// rename / pause / delete -- reached through study actions sheet on the current study
click("picker");click("sacts",{i:"2"});flush();click("rename");q("#r-in").value="french-rep";click("dorename");ok(q("#scopeName").textContent==="french-rep","rename");
// Pause takes the repertoire out of the pool without resetting its schedule, so the scope row
// keeps its numeral and is recoloured `.paused` (review_scope_drawer.dart `_ScopeRow`), and the
// review screen falls back to its nothing-due copy.
click("picker");click("sacts",{i:"2"});flush();click("pause");flush();ok(/due/.test(q("#due").innerHTML),"pause empties the review screen");click("picker");ok(/class="row paused/.test(q("#scopeList").innerHTML),"paused row is marked");
// The numeral must survive pausing — the app only recolours it, because pausing removes the study
// from the pool without touching its schedule. Capture it from the row rather than hardcoding one.
const pausedN=+(/class="row paused[^"]*"[^>]*>[\s\S]*?<b>(\d+)<\/b>/.exec(q("#scopeList").innerHTML)||[0,0])[1];
ok(pausedN>0,"paused row keeps its due count ("+pausedN+")");click("sacts",{i:"2"});flush();click("pause");flush();ok(/due/.test(q("#due").innerHTML),"resume");
// settings
// Library sheet (from more) then Settings row inside it
// The section headers go through esc(), so the ampersand is the escaped entity in the markup.
click("more");click("settings");ok(q(".view-settings").hidden===false&&q("#setTitle").textContent==="Settings"&&/Review &amp; Spaced Repetition/.test(q("#settingsBody").innerHTML)&&/Appearance/.test(q("#settingsBody").innerHTML),"settings sheet");
// SrsSettingsScreen rebuilds from its preferences provider, so a tap re-renders the row group
// rather than flipping one attribute. Assert on the re-rendered markup, not the clicked node.
click("retention",{v:"0.85"});ok(/data-v="0\.85" aria-pressed="true"/.test(q("#settingsBody").innerHTML)&&/data-v="0\.88" aria-pressed="false"/.test(q("#settingsBody").innerHTML),"retention updated");
// apply() writes data-theme / data-accent on the demo root, which is what the generated token file
// keys off — sync-design.js re-anchors the app's tokens from `:root` onto `.app`, so <html> would
// never match. A real dataset coerces to a string; the shim's plain object does not.
// apply() writes data-theme / data-accent on the demo root, because sync-design.js re-anchors the
// app's tokens from `:root` onto `.app` so <html> would never match. The theme is normalised to the
// tokens' own vocabulary — "dark"/"light", not the boolean the settings control carries, which would
// match neither block. A real dataset coerces to a string; the shim's plain object does not.
click("theme",{v:"true"});ok(`${host.dataset.theme}`==="dark","theme applied to the demo root");click("accent",{v:"#E2A84B"});ok(`${host.dataset.accent}`==="#E2A84B","accent applied to the demo root");
click("about");ok(q("#setTitle").textContent==="About"&&q("#settingsBody").innerHTML.includes("GPL-3.0"),"about sheet");
for(let i=0;i<3;i++){click("picker");click("sacts",{i:"0"});flush();click("delete");click("dodelete");flush();}
ok(q(".idle").innerHTML.includes("Bring your study."),"deleting all shows the app's first-run copy");
process.exitCode=fails?1:0;console.log(fails?`\n${fails} FAILED`:"\nALL PASSED");
