/** Small local tones: no audio files, downloads or background polling. */
export class CallSounds {
  private context:AudioContext|null=null;
  enabled=true;
  unlock(){
    try{this.context??=new AudioContext();if(this.context.state==='suspended')void this.context.resume().catch(()=>{});}catch{/* Sound support never blocks joining. */}
  }
  play(kind:'join'|'chat'){
    const context=this.context;if(!this.enabled||!context||context.state!=='running')return;
    const start=context.currentTime;
    for(const [index,frequency]of (kind==='join'?[660,880]:[880,1175]).entries()){
      const tone=context.createOscillator(),gain=context.createGain(),at=start+index*.09;
      tone.type='sine';tone.frequency.value=frequency;
      gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.045,at+.01);gain.gain.exponentialRampToValueAtTime(.001,at+.12);
      tone.connect(gain);gain.connect(context.destination);tone.start(at);tone.stop(at+.13);
      tone.onended=()=>{tone.disconnect();gain.disconnect();};
    }
  }
  close(){const context=this.context;this.context=null;if(context)void context.close().catch(()=>{});}
}
