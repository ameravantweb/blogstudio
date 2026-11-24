import {BookOpen,Feather,FileText,Lock} from 'lucide-react';
import { requireWorkspaceUser } from './auth';

export const dynamic = 'force-dynamic';
export default async function Home() {
  await requireWorkspaceUser();
  return <div className="landing-page">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <header className="app-header"><div className="app-header-inner">
      <a href="/" className="brand"><span className="brand-icon"><Feather size={20}/></span><span>Blog Studio</span></a>
      <nav className="primary-nav" aria-label="Main navigation"><a className="selected" href="/" aria-current="page">Home</a><a href="/workspace">Client articles</a><a href="/workspace/editor">Article workspace</a></nav>
      <span className="landing-access"><Lock size={15}/>Private workspace</span>
    </div></header>
    <main id="main-content" tabIndex={-1} className="landing-main">
      <div className="landing-intro"><span className="landing-kicker">SEO + AEO BLOG STUDIO</span><h1>What would you like to work on?</h1><p>Start a new client article or find your team’s saved work.</p></div>
      <section className="landing-choices" aria-label="Choose where to start">
        <a className="landing-card" href="/workspace/new"><span className="landing-card-icon"><FileText size={27}/></span><h2>Start a new article</h2><p>Build a brief, create a draft, and prepare the article for your client’s website.</p><span className="button primary">Create article</span></a>
        <a className="landing-card" href="/workspace"><span className="landing-card-icon"><BookOpen size={27}/></span><h2>Find client articles</h2><p>Browse briefs, drafts, and completed articles, organized by client.</p><span className="button secondary">Browse client articles</span></a>
      </section>
      <p className="landing-note"><Lock size={15}/>Your team’s articles are saved privately and available wherever you sign in.</p>
    </main>
  </div>;
}
