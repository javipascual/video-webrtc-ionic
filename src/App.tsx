import React, { Component } from 'react';
import '@ionic/core/css/core.css';
import '@ionic/core/css/ionic.bundle.css';
import {
  IonApp,
  IonButton,
  IonContent,
} from '@ionic/react';


interface State {
  inCall: boolean;
}

class App extends Component<{}, State> {
  pc1?: RTCPeerConnection;
  pc2?: RTCPeerConnection;
  localStream?: MediaStream;
  
  constructor(props: {}) {
    super(props);

    this.state = { inCall: false }
    this.call = this.call.bind(this);
    this.hangUp = this.hangUp.bind(this);

    this.onIceCandidate = this.onIceCandidate.bind(this);
    this.onCreateOfferSuccess = this.onCreateOfferSuccess.bind(this);
    this.onCreateSessionDescriptionError = this.onCreateSessionDescriptionError.bind(this);

    this.onSetLocalSuccess = this.onSetLocalSuccess.bind(this);
    this.onSetSessionDescriptionError = this.onSetSessionDescriptionError.bind(this);

    this.getName = this.getName.bind(this);
    this.getOtherPc = this.getOtherPc.bind(this);
  }

  async componentDidMount() {
    console.log('Requesting local stream');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio: true, video: true});
      console.log('Received local stream');

      const localVideo = document.querySelector('#localVideo') as HTMLVideoElement;

      localVideo!.srcObject = stream;
      this.localStream = stream;
    } catch (e) {
      alert(`getUserMedia() error: ${e.name}`);
    }
  }

  getName(pc: RTCPeerConnection) {
    return (pc === this.pc1) ? 'pc1' : 'pc2';
  }
  
  getOtherPc(pc: RTCPeerConnection) {
    return (pc === this.pc1) ? this.pc2 : this.pc1;
  }

  async call() {
    console.log('Starting call');

    const videoTracks = this.localStream!.getVideoTracks();
    const audioTracks = this.localStream!.getAudioTracks();
  
    if (videoTracks.length > 0) {
      console.log(`Using video device: ${videoTracks[0].label}`);
    }

    if (audioTracks.length > 0) {
      console.log(`Using audio device: ${audioTracks[0].label}`);
    }

    const configuration = {};
    console.log('RTCPeerConnection configuration:', configuration);
    this.pc1 = new RTCPeerConnection(configuration);
    console.log('Created local peer connection object pc1');
    this.pc1.addEventListener('icecandidate', e => this.onIceCandidate(this.pc1!, e));
    this.pc2 = new RTCPeerConnection(configuration);
    console.log('Created remote peer connection object pc2');
    this.pc2.addEventListener('icecandidate', e => this.onIceCandidate(this.pc2!, e));
    this.pc1.addEventListener('iceconnectionstatechange', e => this.onIceStateChange(this.pc1!, e as RTCPeerConnectionIceEvent));
    this.pc2.addEventListener('iceconnectionstatechange', e => this.onIceStateChange(this.pc2!, e as RTCPeerConnectionIceEvent));
    this.pc2.addEventListener('track', this.gotRemoteStream);
  
    this.localStream!.getTracks().forEach(track => this.pc1!.addTrack(track, this.localStream!));
    console.log('Added local stream to pc1');
  
    try {
      console.log('pc1 createOffer start');
      const offer = await this.pc1.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      await this.onCreateOfferSuccess(offer);
      this.setState({ inCall: true });
    }
    catch (e) {
      this.onCreateSessionDescriptionError(e);
    }
  }

  onCreateSessionDescriptionError(error: Error) {
    console.log(`Failed to create session description: ${error.toString()}`);
  }
  
  async onCreateOfferSuccess(desc: RTCSessionDescriptionInit) {
    console.log(`Offer from pc1\n${desc.sdp}`);
    console.log('pc1 setLocalDescription start');
    try {
      await this.pc1!.setLocalDescription(desc);
      this.onSetLocalSuccess(this.pc1!);
    }
    catch (e) {
      this.onSetSessionDescriptionError(e);
    }
  
    console.log('pc2 setRemoteDescription start');
    try {
      await this.pc2!.setRemoteDescription(desc);
      this.onSetRemoteSuccess(this.pc2!);
    }
    catch (e) {
      this.onSetSessionDescriptionError(e);
    }
  
    console.log('pc2 createAnswer start');
    // Since the 'remote' side has no media stream we need
    // to pass in the right constraints in order for it to
    // accept the incoming offer of audio and video.
    try {
      const answer = await this.pc2!.createAnswer();
      await this.onCreateAnswerSuccess(answer);
    } catch (e) {
      this.onCreateSessionDescriptionError(e);
    }
  }
  
  onSetLocalSuccess(pc: RTCPeerConnection) {
    console.log(`${this.getName(pc)} setLocalDescription complete`);
  }
  
  onSetRemoteSuccess(pc: RTCPeerConnection) {
    console.log(`${this.getName(pc)} setRemoteDescription complete`);
  }
  
  onSetSessionDescriptionError(error: Error) {
    console.log(`Failed to set session description: ${error.toString()}`);
  }
  
  gotRemoteStream(e: RTCTrackEvent) {
    const remoteVideo = document.querySelector('#remoteVideo') as HTMLVideoElement;

    if (remoteVideo.srcObject !== e.streams[0]) {
      remoteVideo.srcObject = e.streams[0];
      console.log('pc2 received remote stream');
    }
  }
  
  async onCreateAnswerSuccess(desc: RTCSessionDescriptionInit) {
    console.log(`Answer from pc2:\n${desc.sdp}`);
    console.log('pc2 setLocalDescription start');
    try {
      await this.pc2!.setLocalDescription(desc);
      this.onSetLocalSuccess(this.pc2!);
    } catch (e) {
      this.onSetSessionDescriptionError(e);
    }
    console.log('pc1 setRemoteDescription start');
    try {
      await this.pc1!.setRemoteDescription(desc);
      this.onSetRemoteSuccess(this.pc1!);
    } catch (e) {
      this.onSetSessionDescriptionError(e);
    }
  }
  
  async onIceCandidate(pc: RTCPeerConnection, event: RTCPeerConnectionIceEvent) {
    try {
      await (this.getOtherPc(pc)!.addIceCandidate(event.candidate!));
      this.onAddIceCandidateSuccess(pc);
    } catch (e) {
      this.onAddIceCandidateError(pc, e);
    }
    console.log(`${this.getName(pc)} ICE candidate:\n${event.candidate ? event.candidate.candidate : '(null)'}`);
  }
  
  onAddIceCandidateSuccess(pc: RTCPeerConnection) {
    console.log(`${this.getName(pc)} addIceCandidate success`);
  }
  
 onAddIceCandidateError(pc: RTCPeerConnection, error: Error) {
    console.log(`${this.getName(pc)} failed to add ICE Candidate: ${error.toString()}`);
  }
  
  onIceStateChange(pc: RTCPeerConnection, event: RTCPeerConnectionIceEvent) {
    if (pc) {
      console.log(`${this.getName(pc)} ICE state: ${pc.iceConnectionState}`);
      console.log('ICE state change event: ', event);
    }
  }
  
  hangUp() {
    console.log('Ending call');
    this.pc1!.close();
    this.pc2!.close();
    this.pc1 = undefined;
    this.pc2 = undefined;
    this.setState({ inCall: false });
  }
  
  render() {
    return (
      <IonApp>
        <IonContent>
          <h3>Welcome to Ionic Web RTC video call</h3>
          <video id="localVideo" autoPlay muted playsInline></video>
          <video id="remoteVideo" autoPlay playsInline></video>
          <div className="box">
            <IonButton onClick={this.call} disabled={this.state.inCall}>Call</IonButton>
            <IonButton color="danger" onClick={this.hangUp} disabled={!this.state.inCall}>Hang Up</IonButton>
        </div>
        </IonContent>
      </IonApp>
    );
  }
}

export default App;