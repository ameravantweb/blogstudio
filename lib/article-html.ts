import type {Article,ArticleImage} from './blog.ts';
export function escapeHtml(text:string){return text.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));}
function safeLink(url:string){try{const value=new URL(url);return ['http:','https:'].includes(value.protocol)&&!value.username&&!value.password?value.href:null;}catch{return null;}}
function inline(text:string,depth=0):string{
  if(depth>3)return escapeHtml(text);
  const pattern=/`([^`]+)`|\[([^\]]+)\]\(([^\s)]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_/g;let html='',offset=0;let match;
  while((match=pattern.exec(text))){html+=escapeHtml(text.slice(offset,match.index));
    if(match[1])html+=`<code>${escapeHtml(match[1])}</code>`;
    else if(match[2]){const href=safeLink(match[3]);html+=href?`<a href="${escapeHtml(href)}">${inline(match[2],depth+1)}</a>`:inline(match[2],depth+1);}
    else if(match[4]||match[5])html+=`<strong>${inline(match[4]||match[5],depth+1)}</strong>`;
    else html+=`<em>${inline(match[6]||match[7],depth+1)}</em>`;
    offset=pattern.lastIndex;
  }
  return html+escapeHtml(text.slice(offset));
}
export function markdownToHtml(markdown:string){
 const lines=markdown.replace(/\r\n?/g,'\n').split('\n');const blocks:string[]=[];let i=0;
 const tableCells=(line:string)=>line.trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map(cell=>cell.trim());
 while(i<lines.length){const line=lines[i];if(!line.trim()){i++;continue;}
  if(/^```/.test(line)){const code:string[]=[];i++;while(i<lines.length&&!/^```/.test(lines[i]))code.push(lines[i++]);if(i<lines.length)i++;blocks.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);continue;}
  const heading=/^(#{1,6})\s+(.+)$/.exec(line);if(heading){blocks.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`);i++;continue;}
  if(line.includes('|')&&i+1<lines.length&&/^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[i+1])){
   const head=tableCells(line);i+=2;const rows:string[][]=[];while(i<lines.length&&lines[i].trim()&&lines[i].includes('|'))rows.push(tableCells(lines[i++]));blocks.push(`<table><thead><tr>${head.map(cell=>`<th>${inline(cell)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${head.map((_,n)=>`<td>${inline(row[n]||'')}</td>`).join('')}</tr>`).join('')}</tbody></table>`);continue;
  }
  if(/^\s*(?:[-+*]|\d+[.)])\s+/.test(line)){const ordered=/^\s*\d+[.)]\s+/.test(line);const tag=ordered?'ol':'ul';const items:string[]=[];const pattern=ordered?/^\s*\d+[.)]\s+(.+)$/:/^\s*[-+*]\s+(.+)$/;while(i<lines.length){const item=pattern.exec(lines[i]);if(!item)break;items.push(`<li>${inline(item[1])}</li>`);i++;}blocks.push(`<${tag}>${items.join('')}</${tag}>`);continue;}
  if(/^>\s?/.test(line)){const quote:string[]=[];while(i<lines.length&&/^>\s?/.test(lines[i]))quote.push(lines[i++].replace(/^>\s?/,''));blocks.push(`<blockquote><p>${inline(quote.join(' '))}</p></blockquote>`);continue;}
  if(/^\s*(?:---+|\*\*\*+)\s*$/.test(line)){blocks.push('<hr>');i++;continue;}
  const paragraph=[line];i++;while(i<lines.length&&lines[i].trim()&&!/^(?:#{1,6}\s|```|>|\s*[-+*]\s|\s*\d+[.)]\s)/.test(lines[i]))paragraph.push(lines[i++]);blocks.push(`<p>${inline(paragraph.join(' '))}</p>`);
 }
 return blocks.join('\n');
}
export function imageFileName(article:Article){return `${article.slug.toLowerCase().replace(/[^a-z0-9-]/g,'').slice(0,100)||'article'}-featured.webp`;}
export function htmlFragment(article:Article,image:ArticleImage|null=null){return `<article>\n<h1>${escapeHtml(article.title)}</h1>\n${image?`<figure><img src="${imageFileName(article)}" alt="${escapeHtml(image.alt)}" width="${image.width}" height="${image.height}"></figure>\n`:''}${article.answer?`<p class="direct-answer">${inline(article.answer)}</p>\n`:''}${markdownToHtml(article.markdown)}${article.faqs.length?`\n<section aria-label="Frequently asked questions"><h2>Frequently asked questions</h2>\n${article.faqs.map(faq=>`<h3>${escapeHtml(faq.question)}</h3>\n<p>${inline(faq.answer)}</p>`).join('\n')}\n</section>`:''}\n</article>`;}
export function htmlExport(article:Article,image:ArticleImage|null=null){return `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${escapeHtml(article.title)}</title>\n<meta name="description" content="${escapeHtml(article.metaDescription)}">\n<style>body{font:18px/1.7 system-ui,sans-serif;color:#263c31;max-width:850px;margin:48px auto;padding:0 24px}h1,h2,h3{line-height:1.25}img{max-width:100%;height:auto}figure{margin:24px 0}a{color:#365c46}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:10px;text-align:left}blockquote{border-left:3px solid #ccc;margin-left:0;padding-left:20px}.direct-answer{padding:20px;background:#f2f5eb}pre{overflow:auto}</style>\n</head>\n<body>\n${htmlFragment(article,image)}\n</body>\n</html>\n`;}
export function plainTextExport(article:Article){return [article.title,article.answer,article.markdown,...(article.faqs.length?['Frequently asked questions',...article.faqs.flatMap(faq=>[faq.question,faq.answer])]:[])].filter(Boolean).join('\n\n').replace(/\[([^\]]+)\]\(([^)]+)\)/g,'$1 ($2)').replace(/^(?:#{1,6}\s+|>\s?)/gm,'').replace(/\*\*|__|`/g,'');}
