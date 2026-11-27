import subprocess, time, json
from playwright.sync_api import sync_playwright

proc=subprocess.Popen(['node','scripts/phase-five-local.mjs','--serve'],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
try:
    for _ in range(20):
        line=proc.stdout.readline()
        if 'LOCAL_FIXTURE_READY' in line: break
        if not line and proc.poll() is not None: raise RuntimeError('Local fixture failed to start')
    else: raise RuntimeError('Local fixture did not start')
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='chrome',headless=True)
        errors=[]
        def session(name):
            context=browser.new_context(viewport={'width':1366,'height':900})
            context.route('https://**/*',lambda route: route.abort())
            page=context.new_page()
            page.on('pageerror',lambda error:errors.append(str(error)))
            page.goto('http://127.0.0.1:4197/login',wait_until='domcontentloaded')
            page.locator('#login input[name=email]').fill(name+'@local.test')
            page.locator('#password').fill('local-password')
            page.locator('#login button[type=submit]').click()
            page.get_by_role('heading',name='Examinations' if name=='e' else 'My examinations',exact=True).wait_for()
            return context,page
        ec,examiner=session('e')
        card=examiner.locator('.exam-card').filter(has=examiner.get_by_role('heading',name='Local UI assessment',exact=True))
        card.get_by_role('link',name='Manage exam').click()
        examiner.get_by_role('link',name='Monitor and grade').click()
        try: examiner.locator('#live-status').filter(has_text='secure WebSocket connected').wait_for(timeout=10000)
        except Exception:
            print('LIVE STATUS',examiner.locator('#live-status').text_content() if examiner.locator('#live-status').count() else examiner.locator('main').inner_text(),errors)
            raise
        cc,candidate=session('c')
        candidate.locator('.exam-card').filter(has=candidate.get_by_role('heading',name='Local UI assessment',exact=True)).get_by_role('link',name='Open exam').click()
        candidate.locator('#question [name=answer]').first.wait_for()
        deadline=candidate.evaluate("JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>k.includes('attempt-')))).deadline")
        candidate.locator('#question [name=answer]').nth(1).check()
        candidate.locator('#save-state').filter(has_text='All changes saved').wait_for()
        candidate.evaluate("document.querySelector('#question input').dispatchEvent(new Event('paste',{bubbles:true}))")
        examiner.locator('#live-events').filter(has_text='Pasted into an answer').wait_for(timeout=10000)
        candidate.locator('#attempt-dispute').evaluate('(el)=>el.closest("details").open=true')
        candidate.locator('#attempt-dispute textarea').fill('The question has two plausible interpretations.')
        candidate.locator('#attempt-dispute button').click()
        candidate.get_by_text('Question dispute submitted.',exact=True).wait_for()
        candidate.evaluate('navigator.serviceWorker.ready')
        candidate.wait_for_function('Boolean(navigator.serviceWorker.controller)')
        cc.set_offline(True)
        candidate.locator('#next').click()
        candidate.locator('#question [name=answer]').nth(2).check()
        candidate.wait_for_function('''async()=>{const {loadRecord}=await import('/attempt-store.js');const key=Object.keys(localStorage).find(k=>k.includes('pending-'));const name=key.slice(key.indexOf('pending-'));return Object.keys(await loadRecord(name,{})).length>0}''')
        candidate.reload(wait_until='domcontentloaded')
        candidate.locator('#question [name=answer]').first.wait_for()
        assert candidate.evaluate("JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>k.includes('attempt-')))).deadline")==deadline
        cc.set_offline(False)
        candidate.locator('#save-state').filter(has_text='All changes saved').wait_for(timeout=20000)
        accepted=candidate.evaluate('''async()=>{const {examRequest}=await import('/api.js');return examRequest('resume',{examId:location.hash.split('/')[1]})}''')
        assert accepted['deadline']==deadline
        assert accepted['questions'][1]['choice']==2
        examiner.get_by_role('link',name='Back to Manage exam').click()
        examiner.get_by_role('link',name='Dispute queue').click()
        examiner.get_by_text('The question has two plausible interpretations.',exact=True).wait_for()
        examiner.locator('[data-dispute] select').select_option('ambiguous')
        examiner.locator('[data-dispute] textarea').fill('The wording is ambiguous; award full marks to every affected candidate.')
        examiner.locator('[data-dispute] button').click()
        examiner.get_by_text('No matching disputes.',exact=True).wait_for()
        examiner.get_by_role('link',name='View audit log').click()
        examiner.get_by_role('heading',name='Immutable audit log').wait_for()
        assert examiner.locator('.audit-entry').count()>0
        candidate.set_viewport_size({'width':390,'height':844})
        assert candidate.evaluate('document.documentElement.scrollWidth<=innerWidth')
        assert not errors,errors
        browser.close()
        print('PASS local browser: candidate/examiner login, real WebSocket indicator, IndexedDB queue, offline reload, reconnect sync, fixed deadline, dispute resolution, audit UI, mobile layout, no JavaScript errors. No live service contacted.')
finally:
    proc.terminate()
