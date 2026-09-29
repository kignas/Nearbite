import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import HomeHeader from './HomeHeader';
import './legacy-home.css';

function HomeStageTwo() {
  return <>
    <HomeHeader />
    <main className="page">
      <section className="section" aria-label="Home migration preview">
        <div className="sec-head"><h2 className="sec-title">Home migration preview</h2></div>
        <p style={{padding:'0 16px',color:'#5B6472',fontSize:14}}>The original Home header is now rendered by React. The remaining Home sections and their data behavior will be migrated in the next step.</p>
      </section>
    </main>
  </>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><BrowserRouter><HomeStageTwo /></BrowserRouter></React.StrictMode>,
);
