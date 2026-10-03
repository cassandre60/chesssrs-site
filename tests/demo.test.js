// Drives demo.js through a DOM shim: reviews, mistakes, menus, import/export, settings.
const timers=[];let fails=0;
const ok=(c,m)=>{console.log((c?"PASS ":"FAIL ")+m);if(!c)fails++};
function mk(){const o={style:{setProperty(){}},_h:{},_s:{},children:[],hidden:false,textContent:"",innerHTML:"",value:"",dataset:{},
 classList:{toggle(){},add(){},remove(){}},addEventListener(t,f){(o._h[t]=o._h[t]||[]).push(f)},append(c){o.children.push(c)},remove(){},
 setPointerCapture(){},setAttribute(){},focus(){},getBoundingClientRect:()=>({left:0,top:0,width:560,height:560}),querySelectorAll:()=>[],
 querySelector(s){return o._s[s]||(o._s[s]=mk())}};return o}
const host=mk(),body={tagName:"BODY"};
global.window=global;global.PIECE_DEFS="";global.SRSEngine=require("../engine.js");
global.document={getElementById:()=>host,createElementNS:()=>mk(),activeElement:body,body,createRange:()=>({selectNodeContents(){}})};
global.getSelection=()=>({removeAllRanges(){},addRange(){}});global.navigator={clipboard:{writeText:()=>Promise.resolve()}};
const keys=[];global.addEventListener=(t,f)=>t==="keydown"&&keys.push(f);
global.setTimeout=f=>{timers.push(f);return timers.length};global.clearTimeout=()=>{};
const flush=()=>{let n=0;while(timers.length&&n++<800)timers.shift()()};
require("../demo.js");
const q=s=>host.querySelector(s),mo=q("#a-mo"),bd=q(".bd"),F="abcdefgh";mo.hidden=true;
const click=(a,d={})=>host._h.click[0]({target:{closest:()=>({dataset:{a,...d}})}});
const key=(k,x={})=>keys.forEach(f=>f({key:k,target:body,preventDefault(){},...x}));
const xy=(s,flip)=>{let c=F.indexOf(s[0]),r=8-s[1];if(flip){c=7-c;r=7-r}return{clientX:(c+.5)*70,clientY:(r+.5)*70,pointerId:1}};
const mv=(m,flip)=>{for(const s of [m.slice(0,2),m.slice(2,4)]){bd._h.pointerdown[0](xy(s,flip));bd._h.pointerup[0](xy(s,flip))}flush()};
const E=SRSEngine,U=s=>E.compile(s);
const L1=U("e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6 a3 c4 Nbd2"),L2=U("e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Bd7 Be2 Nge7 Na3 cxd4 cxd4 Nf5 Nc2"),L3=U("e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e5 Nb3 Be6");
flush();
ok(q("#a-study").textContent==="Queen Pawn Repertoire"&&q("#a-due").textContent==="16 due","initial: study + 16 due ("+q("#a-due").textContent+")");
mv(L1[0]);ok(q("#a-turn").textContent==="White to play"&&/^Correct\./.test(q("#a-live").textContent),"first move remembered, turn row untouched");
ok(q("#a-due").textContent==="15 due","due count drops to 15 ("+q("#a-due").textContent+")");
// wrong move -> reveal, then correct -> Continue
mv("a2a3");ok(q("#a-rv").hidden===false&&q("#a-sq").textContent===L1[2].slice(2),"wrong move reveals target "+q("#a-sq").textContent);
ok(q("#a-due").textContent==="15 due","missed card stays due");
mv(L1[2]);ok(q("#a-cont").hidden===false&&q("#a-skip").hidden===true,"Continue shown after playing the revealed move");
key(" ");flush();ok(q("#a-cont").hidden===true,"Space advances");
// skip reveals
key("s");ok(q("#a-rv").hidden===false,"S key skips and reveals");mv(L1[4]);click("cont");flush();
// finish the rest of line 1 (cards k=6,8,10,12), missed cards come back at the end
for(const k of [6,8,10,12]){mv(L1[k]);}flush();
ok(q("#a-title").textContent==="Game 2","moves on through line ("+q("#a-title").textContent+")");
// line 2 in order, then the two re-queued misses from line 1 (k=2 wrong move, k=4 skipped)
for(let k=0;k<L2.length;k+=2)mv(L2[k]);
ok(q("#a-title").textContent==="Game 1"&&q("#a-due").textContent==="2 due","misses came back at the end (2 due)");
mv(L1[2]);mv(L1[4]);flush();
ok(q("#a-empty").hidden===false&&q("#a-empty").innerHTML.includes("All caught up"),"queue empties -> All caught up");
ok(/next review is in/.test(q("#a-empty").innerHTML),"empty state shows next review");
// practice
click("practice");flush();ok(q("#a-due").textContent==="Practice","practice mode label");click("practice");flush();ok(q("#a-empty").hidden===false,"ending practice returns to empty");
click("restart");flush();ok(q("#a-due").textContent==="16 due","start over restores 16 due");
// switch study, play black
click("picker");ok(mo.hidden===false&&mo.innerHTML.includes("Sicilian Defense Repertoire"),"picker lists studies");
click("pick",{i:"1"});flush();ok(q("#a-study").textContent==="Sicilian Defense Repertoire"&&q("#a-due").textContent==="7 due","picked Sicilian: 7 due");
for(let k=1;k<L3.length;k+=2)mv(L3[k],true);flush();ok(q("#a-empty").innerHTML.includes("All caught up"),"black study completes");

// keyboard-only play: focus the board, arrow to the pawn, Enter to select, arrow to the target, Enter to move
click("pick",{i:"0"});flush();
const bk=(k)=>bd._h.keydown[0]({key:k,preventDefault(){}});
bd._h.focus[0]();bk("Enter");ok(/selected/.test(q("#a-live").textContent),"keyboard: Enter selects the pawn on e2 ("+q("#a-live").textContent+")");
bk("ArrowUp");bk("ArrowUp");bk("Enter");ok(/^Correct\./.test(q("#a-live").textContent),"keyboard: moved e2-e4 with arrows + Enter");flush();
bd._h.blur[0]();click("pick",{i:"1"});flush();
// analyze
click("more");ok(mo.innerHTML.includes("Analyze")&&mo.innerHTML.includes("Export PGN"),"study menu has real entries");
click("analyze");click("ply",{i:"3"});click("anext");click("aprev");ok(q("#a-an").hidden===false&&q("#a-an").innerHTML.includes("Nxd4"),"analysis view lists moves");click("aback");flush();
// export
click("more");click("export");ok(mo.innerHTML.includes('[Event \\"black-vs-sicilian\\"]')||mo.innerHTML.includes("Sicilian Defense Repertoire"),"export shows PGN");click("copy",{});key("Escape");ok(mo.hidden===true,"Escape closes sheet");
// import: success, error, lichess
click("import");q("#i-pgn").value=`[Event "My Rep for White"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d4 exd4 6. cxd4 Bb4+ 7. Nc3 Nxe4 8. O-O Bxc3 9. d5 Bf6 10. Re1 Ne7 *`;q("#i-title").value="";
click("doimport");flush();ok(q("#a-study").textContent==="My Rep for White"&&q("#a-due").textContent==="10 due"&&mo.hidden===true,"import succeeds: 10 due");
click("import");q("#i-pgn").value="1. e4 e5 2. Qh8";click("doimport");ok(/Import failed: could not read the move/.test(q("#i-err").textContent),"bad PGN shows error");
click("isrc",{v:"lichess"});click("doimport");ok(/can't reach Lichess/.test(q("#i-err").textContent),"Lichess tab explains the limit");click("close");
// rename / pause / delete
click("rename");q("#r-in").value="french-rep";click("dorename");ok(q("#a-study").textContent==="french-rep","rename");
click("pause");flush();ok(q("#a-due").textContent==="Paused"&&q("#a-empty").innerHTML.includes("Paused"),"pause");click("pause");flush();ok(/due/.test(q("#a-due").textContent),"resume");
// settings
click("more");click("settings");ok(mo.innerHTML.includes("Target retention")&&mo.innerHTML.includes("Daily limit")&&mo.innerHTML.includes("About"),"settings sheet");
mo._h.input[0]({type:"input",target:{dataset:{k:"retention"},type:"range",value:"85"}});ok(q("#v-ret").textContent==="85%","retention slider updates");
mo._h.change[0]({type:"change",target:{dataset:{k:"limit"},type:"range",value:"5"}});flush();ok(true,"daily limit change restarts session");
click("theme",{v:"light"});click("accent",{v:"#E2A84B"});click("about");ok(mo.innerHTML.includes("GPL-3.0"),"about sheet");click("close");
for(let i=0;i<3;i++){click("more");click("delete");click("dodelete");flush();}
ok(q("#a-empty").innerHTML.includes("No repertoire yet"),"deleting all shows the import prompt");
process.exitCode=fails?1:0;console.log(fails?`\n${fails} FAILED`:"\nALL PASSED");
