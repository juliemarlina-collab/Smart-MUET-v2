"""Correct Vault 1 Listening Part IV against the supplied scanned question paper.
Usage: python3 apply.py /path/to/Smart-MUET-v2
Only vault1-listening.html is changed; all other Parts and audio files are preserved.
"""
from pathlib import Path
import json
import re
import sys

root = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path.cwd()
path = root / 'vault1-listening.html'
s = path.read_text(encoding='utf-8')
questions = [
 ('Memorisation process occurs when you', ['make a grocery list', 'stand at the supermarket', 'study for an examination']),
 ('Mr Ruben’s tips on memorisation are based on what we', ['do as young children', 'learnt at nursery school', 'went through as children']),
 ('We use both types of memory to', ['construct answers', 'recall information', 'remember concepts']),
 ('To use the word association technique, Mr Ruben suggests', ['naming your pet dog', 'using familiar words', 'reading a science concept']),
 ('It is easy to remember dates when you imagine the', ['lists on the wall', 'graffiti on the wall', 'images on the wall']),
 ('Mr Ruben claims that singing is', ['useful for tricking your mind', 'better than reading a text aloud', 'effective when learning new concepts']),
 ('The best method for “Teach it” is to', ['teach your group members', 'pretend teaching your friends', 'record a video of yourself teaching']),
]
key = [2,0,1,1,1,2,2] # 18–24: C A B B B C C (Session 3 2022 teacher key)
assert len(questions) == len(key) == 7
article_re = re.compile(r'(<article\b[^>]*data-part-name="Part IV [^\"]*"[^>]*>)(.*?)(</article>)', re.S)
match = article_re.search(s)
if not match:
 raise SystemExit('Part IV article not found; no changes made.')
body = match.group(2)
if not any(name in body for name in ('Dr Ranjit Singh','Dr Ruben','Mr Ruben')):
 raise SystemExit('Part IV speaker differs from the expected version; no changes made.')
body = body.replace('Dr Ruben','Mr Ruben')
body = body.replace('<span>Dr Ranjit Singh</span>', '<span>Yasmin and Mr Ruben · Improving memory</span>')
body = body.replace('aria-label="Listening track 4"', 'aria-label="Part IV radio interview with Yasmin and Mr Ruben, questions 18 to 24"')
body = body.replace('Download track 4 for a playback backup', 'Download Part IV interview for a playback backup')
intro = '<p>Listen to a radio interview between Yasmin and Mr Ruben about improving memory. Answer Questions 18–24.</p>'
if intro not in body:
 body = re.sub(r'(<div class="audio-head">.*?</div>\s*<audio\b.*?</audio>.*?</a>)',r'\1\n        '+intro,body,count=1,flags=re.S)
for index,(stem,options) in enumerate(questions,17):
 card_re = re.compile(r'(<div class="qcard" data-q="'+str(index)+r'">)(.*?)(</div>\s*(?=<div class="qcard"|<button class="part-submit"))', re.S)
 card = card_re.search(body)
 if not card:
  raise SystemExit(f'Question {index+1} not found; no changes made.')
 html = card.group(2)
 html,n = re.subn(r'(<p class="stem">).*?(</p>)',lambda m:m.group(1)+stem+m.group(2),html,count=1,flags=re.S)
 assert n==1
 opts = '\n        '+''.join(f'<label class="opt" id="opt-{index}-{j}"><input type="radio" name="q{index}" value="{j}"><span>{chr(65+j)}. {option}</span></label>' for j,option in enumerate(options))+'\n      '
 html,n = re.subn(r'(?<=<div class="opts">).*?(?=</div>)',lambda _:opts,html,count=1,flags=re.S)
 assert n==1
 explanation = f'The source answer key gives {chr(65+key[index-17])} for Question {index+1}.'
 html,n = re.subn(r'(<div class="explain" id="exp-'+str(index)+r'">).*?(</div>)',lambda m:m.group(1)+explanation+m.group(2),html,count=1,flags=re.S)
 assert n==1
 body = body[:card.start(2)]+html+body[card.end(2):]
s=s[:match.start(2)]+body+s[match.end(2):]
answers_re=re.compile(r'const answers\s*=\s*(\[[^;]*\]);')
a=answers_re.search(s)
if not a:raise SystemExit('Answer array not found; no changes made.')
values=json.loads(a.group(1));assert len(values)==30
values[17:24]=key
s=s[:a.start(1)]+json.dumps(values)+s[a.end(1):]
e=re.search(r'const explanations\s*=\s*(\[[^;]*\]);',s)
if e:
 explanations=json.loads(e.group(1));assert len(explanations)==30
 explanations[17:24]=[f'The source answer key gives {chr(65+k)} for Question {i+18}.' for i,k in enumerate(key)]
 s=s[:e.start(1)]+json.dumps(explanations,ensure_ascii=False)+s[e.end(1):]
version='''// Part IV was replaced: do not grade saved answers to the old interview.
try{
  if(localStorage.getItem('muet_v1_listening_part4_bank_version')!=='2'){
    const storageKey='muet_v1_listening_responses';
    const saved=JSON.parse(localStorage.getItem(storageKey)||'{}');
    for(let index=17;index<=23;index++)delete saved[String(index)];
    localStorage.setItem(storageKey,JSON.stringify(saved));
    for(const suffix of ['','_score','_score90','_result'])localStorage.removeItem('muet_v1_listening'+suffix);
    localStorage.setItem('muet_v1_listening_part4_bank_version','2');
  }
}catch(_){/* If storage is unavailable, questions remain usable. */}
'''
if 'muet_v1_listening_part4_bank_version' not in s:
 init='const objectivePaper=SmartMUETObjective.init('
 assert init in s
 s=s.replace(init,version+init,1)
path.write_text(s,encoding='utf-8')
print('Updated',path)
print('Part IV Questions 18–24 and key: C A B B B C C')
