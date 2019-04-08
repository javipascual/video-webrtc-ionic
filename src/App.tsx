import React, { Component } from 'react';
import '@ionic/core/css/core.css';
import '@ionic/core/css/ionic.bundle.css';
import {
  IonApp,
  IonButton,
  IonContent,
} from '@ionic/react';
import * as firebase from 'firebase';

const servers = {
  'iceServers': [
    {'urls': 'stun:stun.services.mozilla.com'},
    {'urls': 'stun:stun.l.google.com:19302'},
    {'urls': 'turn:numb.viagenie.ca','credential': 'beaver','username': 'webrtc.websitebeaver@gmail.com'}
  ]
};

interface State {
  inCall: boolean;
}

class App extends Component<{}, State> {
  pc1?: RTCPeerConnection;
  pc2?: RTCPeerConnection;
  pc: RTCPeerConnection;
  localStream?: MediaStream;
  database: firebase.database.Reference;
  id: number;
  
  constructor(props: {}) {
    super(props);

    this.id = Math.floor(Math.random()*1000000000);
    this.pc = new RTCPeerConnection(servers);

    const cfg = {
      apiKey: "AIzaSyAathUls5mxSGQVfObJJj3_1Gsqy5D5mtI",
      authDomain: "testwebrtc-90120.firebaseapp.com",
      databaseURL: "https://testwebrtc-90120.firebaseio.com",
      projectId: "testwebrtc-90120",
      storageBucket: "testwebrtc-90120.appspot.com",
      messagingSenderId: "914167919631"
    };

    firebase.initializeApp(cfg);
    this.database = firebase.database().ref();
    this.database.on('child_added', this.readMessage);

    this.state = { inCall: false }
    this.call = this.call.bind(this);
    this.hangUp = this.hangUp.bind(this);

    this.onIceCandidate = this.onIceCandidate.bind(this);
    this.onCreateSessionDescriptionError = this.onCreateSessionDescriptionError.bind(this);
    this.onSetSessionDescriptionError = this.onSetSessionDescriptionError.bind(this);

    this.getName = this.getName.bind(this);
    this.getOtherPc = this.getOtherPc.bind(this);

    this.sendMessage = this.sendMessage.bind(this);
    this.readMessage = this.readMessage.bind(this);
  }

  async componentDidMount() {
    this.pc.addEventListener('icecandidate', e => {
      e.candidate ? this.sendMessage(this.id, JSON.stringify({'ice': e.candidate})) : console.log("Sent All Ice");
    });

    // this.pc.addEventListener('icecandidate', e => {
    //   e.candidate ? this.sendMessage(this.id, JSON.stringify({'ice': e.candidate})) : console.log("Sent All Ice");
    // });



    console.log('Requesting local stream');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio: true, video: true});
      console.log('Received local stream');

      this.localStream = stream;
  
    } catch (e) {
      alert(`getUserMedia() error: ${e.name}`);
    }
  }
  
  sendMessage(sender: number, message: string) {
    var msg = this.database.push({ sender, message });
    msg.remove();
  }

  async readMessage(data: any) {
    var msg = JSON.parse(data.val().message);
    var sender = data.val().sender;
    if (sender != this.id) {
        if (msg.ice != undefined) {
          this.pc.addIceCandidate(new RTCIceCandidate(msg.ice));
        } else if (msg.sdp.type == "offer") {
          await this.pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          const answer = await this.pc.createAnswer()
          await this.pc.setLocalDescription(answer);
          this.sendMessage(this.id, JSON.stringify({'sdp': this.pc.localDescription}));
        } else if (msg.sdp.type == "answer") {
          this.pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        }
    }
};

  getName(pc: RTCPeerConnection) {
    return (pc === this.pc1) ? 'pc1' : 'pc2';
  }
  
  getOtherPc(pc: RTCPeerConnection) {
    return (pc === this.pc1) ? this.pc2 : this.pc1;
  }

  async call() {
    console.log('Starting call');

    // add local video
    const localVideo = document.querySelector('#localVideo') as HTMLVideoElement;
    localVideo.srcObject = this.localStream!;
    // publish local video and audio
    this.localStream!.getTracks().forEach(t => this.pc.addTrack(t));

    // send offer
    const offer = await this.pc.createOffer();
    this.pc.setLocalDescription(offer)
    // this.pc1 = new RTCPeerConnection();
    // console.log('Created local peer connection object pc1');
    // this.pc1.addEventListener('icecandidate', e => this.onIceCandidate(this.pc1!, e));
    // this.pc2 = new RTCPeerConnection();
    // console.log('Created remote peer connection object pc2');
    // this.pc2.addEventListener('icecandidate', e => this.onIceCandidate(this.pc2!, e));
    // this.pc2.addEventListener('track', this.gotRemoteStream);
  
    // this.localStream!.getTracks().forEach(track => this.pc1!.addTrack(track, this.localStream!));
    // console.log('Added local stream to pc1');
  
    // try {
    //   console.log('pc1 createOffer start');
    //   const offer = await this.pc1.createOffer({
    //     offerToReceiveAudio: true,
    //     offerToReceiveVideo: true
    //   });
    //   await this.onCreateOfferSuccess(offer);
    //   this.setState({ inCall: true });
    // }
    // catch (e) {
    //   this.onCreateSessionDescriptionError(e);
    // }
  }

  onCreateSessionDescriptionError(error: Error) {
    console.log(`Failed to create session description: ${error.toString()}`);
  }
  
  async onCreateOfferSuccess(desc: RTCSessionDescriptionInit) {
    console.log(`Offer from pc1\n${desc.sdp}`);
    console.log('pc1 setLocalDescription start');
    try {
      await this.pc1!.setLocalDescription(desc);
    }
    catch (e) {
      this.onSetSessionDescriptionError(e);
    }
  
    console.log('pc2 setRemoteDescription start');
    try {
      await this.pc2!.setRemoteDescription(desc);
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
    } catch (e) {
      this.onSetSessionDescriptionError(e);
    }
    console.log('pc1 setRemoteDescription start');
    try {
      await this.pc1!.setRemoteDescription(desc);
    } catch (e) {
      this.onSetSessionDescriptionError(e);
    }
  }
  
  async onIceCandidate(pc: RTCPeerConnection, event: RTCPeerConnectionIceEvent) {
    try {
      await (this.getOtherPc(pc)!.addIceCandidate(event.candidate!));
    } catch (e) {
      this.onAddIceCandidateError(pc, e);
    }
    console.log(`${this.getName(pc)} ICE candidate:\n${event.candidate ? event.candidate.candidate : '(null)'}`);
  }

  onAddIceCandidateError(pc: RTCPeerConnection, error: Error) {
    console.log(`${this.getName(pc)} failed to add ICE Candidate: ${error.toString()}`);
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