/** Read the normal JSON response or the keep-alive generation stream. */
export async function readGenerationResponse(response:Response):Promise<{error?:string;article?:unknown;image?:unknown}>{
  const contentType=response.headers.get('Content-Type')?.toLowerCase()||'';
  if(response.redirected||response.status===401||response.status===403){
    throw new Error('Your sign-in session needs attention. Export your brief as a backup, then reload this page and sign in again.');
  }
  const fallback=()=>new Error([408,502,503,504,524].includes(response.status)
    ? 'The generation connection was interrupted or timed out. Your brief and existing draft are safe. Please try again.'
    : `The article service returned an unexpected response${response.status>=400?` (HTTP ${response.status})`:''}. Your brief and existing draft are safe. Please reload the page and try again.`);
  if(contentType.includes('application/x-ndjson')){
    const reader=response.body?.getReader();if(!reader)throw fallback();
    const decoder=new TextDecoder();let buffer='';
    try{
      while(true){
        const part=await reader.read();buffer+=decoder.decode(part.value,{stream:!part.done});
        if(buffer.length>500000)throw fallback();
        const lines=buffer.split('\n');buffer=lines.pop()||'';
        if(part.done&&buffer){lines.push(buffer);buffer='';}
        for(const line of lines){
          if(!line.trim())continue;
          let event;try{event=JSON.parse(line);}catch{throw fallback();}
          if(event?.type==='result'&&event.data&&typeof event.data==='object')return event.data;
          if(event?.type!=='working')throw fallback();
        }
        if(part.done)throw fallback();
      }
    }finally{await reader.cancel().catch(()=>{});}
  }
  // Hosting/authentication errors can be HTML, even for a JSON API endpoint.
  // Never show HTML or a raw JSON parser exception to the user.
  let result;try{result=JSON.parse(await response.text());}catch{throw fallback();}
  if(!result||typeof result!=='object'||Array.isArray(result))throw fallback();
  if(!response.ok)throw new Error(typeof result.error==='string'?result.error:fallback().message);
  return result;
}
