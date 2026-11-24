// Run this entire script in the browser developer console while signed in to
// your existing private Blog Studio. It makes read-only, same-origin requests.
(async()=>{
  const response=await fetch('/api/records',{credentials:'same-origin',cache:'no-store'});
  if(!response.ok)throw new Error('Open Blog Studio and sign in before exporting.');
  const workspace=await response.json();
  if(!Array.isArray(workspace.records))throw new Error('Article workspace was not returned.');
  const ids=[...new Set(workspace.records.map(row=>row.record?.image?.id).filter(Boolean))];
  const images=[];
  for(const id of ids){
    if(!/^[a-f0-9-]{36}$/.test(id))throw new Error('Invalid image ID; export stopped.');
    const result=await fetch('/api/images/'+id,{credentials:'same-origin',cache:'no-store'});
    if(!result.ok)throw new Error('Image '+id+' could not be exported; retry before moving the workspace.');
    const blob=await result.blob();
    const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});
    images.push({id,base64:dataUrl.split(',')[1]});
  }
  const backup={format:'blog-studio-workspace-v1',exportedAt:new Date().toISOString(),records:workspace.records,images};
  const url=URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download='workspace-export-'+new Date().toISOString().slice(0,10)+'.json';link.click();
  setTimeout(()=>URL.revokeObjectURL(url),10000);
  console.info('Exported '+workspace.records.length+' briefs/articles and '+images.length+' images. Keep the downloaded backup private.');
})().catch(error=>console.error('Export stopped:',error.message));
