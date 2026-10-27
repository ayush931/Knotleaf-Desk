"use client";
import { Component, type ReactNode } from 'react';
/** A missing preview chunk or malformed document must never take away editable source. */
export class MarkdownPreviewBoundary extends Component<{resetKey:string;onSource:()=>void;children:ReactNode},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  componentDidUpdate(previous:{resetKey:string}){if(this.state.failed&&previous.resetKey!==this.props.resetKey)this.setState({failed:false});}
  render(){
    if(this.state.failed)return <div role="alert" className="space-y-3 p-6 text-sm"><p>Could not open this preview. Your Markdown source is safe. Check the source or reload the app if the preview could not be downloaded.</p><button type="button" className="rounded-md border border-neutral-500 px-3 py-2 hover:opacity-80 focus-visible:outline-2 focus-visible:outline-blue-500" onClick={this.props.onSource}>Open Markdown source</button></div>;
    return this.props.children;
  }
}
