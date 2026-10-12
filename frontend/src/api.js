// Credentials stay in an HttpOnly cookie; portal components retain their fetch API.
export async function apiFetch(url,options={}) {
  const response=await window.fetch(url,{...options,credentials:'include'});
  if(!response.ok){let data;try{data=await response.json();}catch{data={message:'The server returned an unexpected response'};}
    if(response.status===401)window.dispatchEvent(new Event('session-expired'));
    throw new Error(data.message||`Request failed (${response.status})`);
  }
  // Existing portals consume arrays. Retrieve growing collections in bounded API pages.
  const parsed=new URL(url,window.location.origin);
  const paged=/^\/api\/(students|staff|issues|audit|requests(?:\/(?:student|staff)\/[^/]+)?)$/.test(parsed.pathname);
  if(paged&&!parsed.searchParams.has('page')&&(!options.method||options.method==='GET')){
    const items=await response.json();let next=response.headers.get('X-Next-Page');
    while(next){parsed.searchParams.set('page',next);parsed.searchParams.set('format','array');const page=await apiFetch(parsed.toString(),options);items.push(...await page.json());next=page.headers.get('X-Next-Page');}
    return new Response(JSON.stringify(items),{status:response.status,headers:{'Content-Type':'application/json'}});
  }
  return response;
}
