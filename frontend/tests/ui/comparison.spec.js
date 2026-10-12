import {test,expect} from '@playwright/test';
import {installFixtures} from './fixtures';
for(const role of ['landing','admin','student','staff'])test(`comparison ${role}`,async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await installFixtures(page,role==='landing'?null:role);await page.goto(role==='landing'?'/':'/'+role);
 if(role==='landing')await expect(page.locator(process.env.COMPARE_PHASE==='before'?'.washer-front':'.studio-washer')).toBeVisible();else {await expect(page.locator('.portal-'+role)).toBeVisible();await expect(page.getByRole('button',{name:'Refresh workspace'})).toBeEnabled();}
 await page.getByText('Refreshing records…',{exact:true}).waitFor({state:'hidden'});await page.evaluate(()=>document.activeElement?.blur());
 await page.addStyleTag({content:'.comparison-label{position:fixed;bottom:10px;left:50%;transform:translateX(-50%);z-index:999;background:#13243e;color:white;padding:7px 13px;font:10px system-ui;pointer-events:none}'});
 await page.evaluate(label=>{const el=document.createElement('div');el.className='comparison-label';el.textContent=label;document.body.append(el);},`${process.env.COMPARE_PHASE||'after'} · 1440 × 1000 · browser API fixtures`);
 await page.screenshot({path:`../ui-preview/comparison/${process.env.COMPARE_PHASE||'after'}-${role}.png`,fullPage:false,animations:'disabled'});
});
test('studio asset failure retains the CSS washer and motion controls',async({page})=>{
 await installFixtures(page,null);await page.route('**/washer-studio.webp',route=>route.abort());await page.goto('/');await expect(page.locator('.washer-front')).toBeVisible();await expect(page.locator('.studio-washer')).toHaveCount(0);await page.getByRole('button',{name:'Pause visual motion'}).click();await expect(page.locator('.washer-drum')).toHaveCSS('animation-play-state','paused');
});
test('editorial overview links and workflow stages keep navigation functional',async({page})=>{
 await installFixtures(page,'admin');await page.goto('/admin');await page.locator('.campus-ledger').getByRole('button',{name:/Active students/}).click();await expect(page.locator('.main-header h2')).toHaveText('Student Mapping');await page.unroute('**/api/**');await installFixtures(page,'staff');await page.goto('/staff');await page.locator('.queue-status-card').filter({hasText:'Ready to collect'}).click();await expect(page.getByLabel('Filter queue status')).toHaveValue('Ready');await expect(page.locator('.staff-queue tbody tr')).toHaveCount(2);
});
