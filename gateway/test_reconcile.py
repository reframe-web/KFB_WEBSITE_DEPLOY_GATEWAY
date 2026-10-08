import pathlib,tempfile,unittest,json,subprocess,sys
from PIL import Image
BASE=pathlib.Path(__file__).parent
class TestImageRecovery(unittest.TestCase):
 def test_one_original_and_approval_unmodified(self):
  with tempfile.TemporaryDirectory() as folder:
   d=pathlib.Path(folder);(d/'originals').mkdir()
   Image.new('RGB',(80,70),color=(140,150,160)).save(d/'originals'/'ok.png')
   url='https://web-resource.tsuku2.jp/pic/blog/test/approved-source.png';aid='legacy-tsukutsuku-test'
   src={'items':[{'id':aid,'status':'preview','privacy':'source_public_unreviewed','client_approved':False,'media_approved':False,'body_html':'<img src="'+url+'">','body_en':'<img src="'+url+'">','image':{'src':url},'unresolved_media_count':1,'local_media_count':0}]}
   feed={'items':[{'id':aid,'image':{'src':url},'unresolved_media_count':1,'local_media_count':0}]}
   audit={'outstanding':[{'id':aid,'source_url':url}]}
   mapping={'images':[{'source_url':url,'file':'ok.png','attested_by':'KFB authorized operator','provenance':'authorized_cms_download'}]}
   for name,data in [('src',src),('feed',feed),('audit',audit),('map',mapping)]:
    (d/(name+'.json')).write_text(json.dumps(data),encoding='utf-8')
   run=subprocess.run([sys.executable,str(BASE/'reconcile_legacy_images.py'),'--legacy-preview',str(d/'src.json'),'--legacy-feed',str(d/'feed.json'),'--outstanding-audit',str(d/'audit.json'),'--mapping',str(d/'map.json'),'--files-root',str(d/'originals'),'--outdir',str(d/'staging')],capture_output=True,text=True)
   self.assertEqual(run.returncode,0,run.stderr)
   after=json.loads((d/'staging'/'legacy-preview.json').read_text())['items'][0]
   self.assertEqual(after['unresolved_media_count'],0)
   self.assertFalse(after['client_approved']);self.assertFalse(after['media_approved'])
   self.assertIn('/assets/legacy/',after['body_html']);self.assertNotIn(url,after['body_html'])
 def test_rejects_unlisted_url(self):
  with tempfile.TemporaryDirectory() as folder:
   d=pathlib.Path(folder);(d/'originals').mkdir()
   Image.new('RGB',(80,80)).save(d/'originals'/'ok.png')
   src={'items':[]};feed={'items':[]};audit={'outstanding':[]};mapping={'images':[{'source_url':'https://evil.example/test','file':'ok.png','attested_by':'KFB operator','provenance':'authorized_cms_download'}]}
   for name,doc in [('src',src),('feed',feed),('audit',audit),('map',mapping)]: (d/(name+'.json')).write_text(json.dumps(doc))
   run=subprocess.run([sys.executable,str(BASE/'reconcile_legacy_images.py'),'--legacy-preview',str(d/'src.json'),'--legacy-feed',str(d/'feed.json'),'--outstanding-audit',str(d/'audit.json'),'--mapping',str(d/'map.json'),'--files-root',str(d/'originals'),'--outdir',str(d/'staging')],capture_output=True,text=True)
   self.assertNotEqual(run.returncode,0)
if __name__=='__main__':unittest.main()
