"""Rebuild the standalone Offline Museum Kit page from exhibit.json.

Vendored family style + mesh engine live in build/vendor/; everything is embedded
into the single index.html. Run from the repository root:  python build/build_museum.py
"""
import json
from pathlib import Path
root=Path(__file__).resolve().parent.parent
vendor=Path(__file__).resolve().parent/'vendor'
data=json.loads((root/'exhibit.json').read_text(encoding='utf-8'))
style=(vendor/'style.css').read_text(encoding='utf-8')
geometry=(vendor/'geometry.js').read_text(encoding='utf-8')
renderer=(vendor/'renderer.js').read_text(encoding='utf-8')
# Both scripts and exhibit data are embedded: the exported page has no runtime assets.
body='''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Offline Museum Kit</title>
<style>STYLE
#canvas{height:430px}#canvas[hidden]{display:none}@media(max-width:760px){#canvas{height:320px}}</style>
</head>
<body>
<a class="skip" href="#workspace">Skip to the exhibit workspace</a>
<main data-ui-revision="portfolio-preview-1">
<p class="prototype" id="prototype-notice"><strong>Portfolio preview</strong>Experimental concept prototype — idea exploration only. Not a finished or production-ready product; the three fictional exhibits and their tests demonstrate the concept.</p>
<header class="masthead"><div><p class="eyebrow">FREDY-E / PORTABLE EXPERIENCES</p><h1>Offline Museum Kit</h1><p class="subtitle" id="intro"></p><ul class="facts"><li>One HTML file</li><li>WebGL2 with readable fallback</li><li>Three guided stops</li></ul></div><span class="icon" aria-hidden="true">OM</span></header>
<nav class="guide" aria-label="How to use this exhibit"><h2>How to use this exhibit</h2><ol><li><b>1</b><span><strong>Look</strong> — the 3D view renders one procedural form at a time.</span></li><li><b>2</b><span><strong>Move</strong> — Previous and Next, the numbered stops, or the left and right arrow keys.</span></li><li><b>3</b><span><strong>Read and print</strong> — every caption stays readable below, and Print exhibit keeps text only.</span></li></ol></nav>
<div class="exhibit" id="workspace"><section class="stage" aria-label="3D exhibit view"><canvas id="canvas" aria-label="Procedural 3D exhibit"></canvas><p class="meta">← → arrow keys move between exhibits. All captions remain readable below.</p></section>
<section class="panel" aria-label="Exhibit controls"><p class="eyebrow" id="step"></p><h2 id="title"></h2><p id="description"></p><div class="toolbar"><button id="previous">Previous</button><button class="primary" id="next">Next</button></div><div id="dots" class="toolbar" role="group" aria-label="Exhibit stops"></div><button id="print">Print exhibit</button></section>
</div>
<p class="notice" id="message" role="status">A fictional exhibition, built from formulas. This page works offline.</p>
<section class="captions" id="captions" aria-label="All exhibit captions"><h2>All captions</h2></section>
<footer>Offline Museum Kit · One HTML file · WebGL2 with readable fallback</footer>
</main>
<script>GEOMETRY</script>
<script>RENDERER</script>
<script>
const exhibit=DATA;const $=x=>document.getElementById(x);$('intro').textContent=exhibit.description;let selected=0,renderer;let mesh;function build(item){const model=MeshGeometry.surface(item.shape,48,24);const positions=[];for(let i=0;i<model.positions.length;i+=3)positions.push(model.positions[i]*.82,model.positions[i+1]*.82+.28,model.positions[i+2]*.82);return{...model,positions}};try{renderer=MeshRenderer.create($('canvas'))}catch(error){$('message').textContent='3D rendering is unavailable. All exhibit captions and navigation still work.';$('canvas').hidden=true;}
exhibit.items.forEach((item,index)=>{const article=document.createElement('article'),h=document.createElement('h2'),p=document.createElement('p');h.textContent=item.title;p.textContent=item.description;article.append(h,p);$('captions').append(article);const button=document.createElement('button');button.textContent=index+1;button.setAttribute('aria-label','Go to '+item.title);button.onclick=()=>show(index);$('dots').append(button)});function show(index){selected=Math.max(0,Math.min(exhibit.items.length-1,index));const item=exhibit.items[selected];$('step').textContent=`EXHIBIT ${selected+1} / ${exhibit.items.length}`;$('title').textContent=item.title;$('description').textContent=item.description;$('previous').disabled=selected===0;$('next').disabled=selected===exhibit.items.length-1;Array.from($('dots').children).forEach((b,i)=>{b.classList.toggle('primary',i===selected);b.setAttribute('aria-pressed',String(i===selected))});mesh=build(item);renderer?.update(mesh);draw();}function draw(){renderer?.draw({azimuth:[.45,.8,.6][selected]||.5,elevation:[.25,.75,.4][selected]||.4,distance:3.8})}$('previous').onclick=()=>show(selected-1);$('next').onclick=()=>show(selected+1);$('print').onclick=()=>window.print();window.addEventListener('keydown',event=>{if(['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName))return;if(event.key==='ArrowRight'){event.preventDefault();show(selected+1)}if(event.key==='ArrowLeft'){event.preventDefault();show(selected-1)}});window.addEventListener('resize',draw);show(0);
</script>
</body>
</html>'''
body=body.replace('STYLE',style).replace('GEOMETRY',geometry).replace('RENDERER',renderer).replace('DATA',json.dumps(data).replace('<','\\u003c'))
(root/'index.html').write_text(body,encoding='utf-8')
print('Built standalone Offline Museum Kit page with embedded geometry, renderer, styles, and captions.')
