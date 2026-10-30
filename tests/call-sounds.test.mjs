import {test,expect} from 'bun:test';
import {CallSounds} from '../lib/callSounds.ts';
test('call sounds synthesize quiet local tones, honor mute and release their audio context',()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'AudioContext');const tones=[];let closed=0;
 class AudioContext{state='running';currentTime=1;destination={};createOscillator(){const tone={frequency:{},connect(){},disconnect(){},start(){},stop(){}};tones.push(tone);return tone;}createGain(){return{gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}async close(){closed++;}}
 Object.defineProperty(globalThis,'AudioContext',{configurable:true,value:AudioContext});
 try{const sounds=new CallSounds();sounds.unlock();sounds.play('join');expect(tones.map(tone=>tone.frequency.value)).toEqual([660,880]);sounds.enabled=false;sounds.play('chat');expect(tones).toHaveLength(2);sounds.enabled=true;sounds.play('chat');expect(tones.slice(2).map(tone=>tone.frequency.value)).toEqual([880,1175]);sounds.close();expect(closed).toBe(1);sounds.play('chat');expect(tones).toHaveLength(4);}finally{if(original)Object.defineProperty(globalThis,'AudioContext',original);else delete globalThis.AudioContext;}
});
