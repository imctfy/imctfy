#!/usr/bin/env python3
"""Analisis dependensi: pecah JS inline index.html menjadi blok top-level, hitung referensi antar blok dan id DOM per panel."""
import re, json, sys, collections
SRC = sys.argv[1] if len(sys.argv)>1 else 'original/ctfylink-main/index.html'
L = open(SRC, encoding='utf-8').read().split('\n')
JS0, JS1 = 6212, 11701            # baris 1-based: isi script = JS0+1 .. JS1-1
body = L[4840:6211]
js_lines = L[JS0:JS1-1]           # tanpa <script> dan </script>
start_re = re.compile(r'^ {8}(?:async\s+function\s+(\w+)|function\s+(\w+)|(?:const|let|var)\s+(\w+)|window\.(\w+)\s*=|(\w+)\(\);)')
blocks=[]; cur=None
for i,s in enumerate(js_lines):
    m=start_re.match(s)
    if m:
        name=next((g for g in m.groups() if g), '?')
        kind='stmt' if m.group(5) else ('winassign' if m.group(4) else 'decl')
        cur={'name':name,'kind':kind,'start':JS0+1+i,'lines':[s]}
        blocks.append(cur)
    elif cur is not None:
        cur['lines'].append(s)
for b in blocks: b['end']=b['start']+len(b['lines'])-1; b['text']='\n'.join(b['lines'])
names={b['name'] for b in blocks if b['kind']=='decl'}
# panel id sets
def span(a,b): return '\n'.join(L[a-1:b])
panels={'header+nav+footer+dock':span(4841,4883)+span(5975,6041),'platform':span(4884,5148),'library':span(5149,5225),'tools':span(5226,5744),'tentang':span(5745,5974),'supportPopup':span(6042,6122),'waPopup':span(6123,6134),'itemModal':span(6135,6211)}
idsets={k:set(re.findall(r'\bid="([^"$]+)"',v)) for k,v in panels.items()}
out=[]
for b in blocks:
    refs=sorted(n for n in names if n!=b['name'] and re.search(r'\b'+re.escape(n)+r'\b',b['text']))
    ids=set(re.findall(r"getElementById\(\s*['\"]([\w-]+)['\"]",b['text']))|set(re.findall(r"querySelector(?:All)?\(\s*['\"]#([\w-]+)",b['text']))
    where=collections.defaultdict(list)
    for i in ids:
        f=[k for k,v in idsets.items() if i in v]
        where[','.join(f) if f else 'DINAMIS/TIDAK-ADA'].append(i)
    out.append({'name':b['name'],'kind':b['kind'],'start':b['start'],'end':b['end'],'refs':refs,'ids':{k:sorted(v) for k,v in where.items()}})
json.dump(out,open('/home/claude/work/js_blocks.json','w'),indent=0)
print(len(blocks),'blok;',len(names),'deklarasi')
print({k:len(v) for k,v in idsets.items()})
