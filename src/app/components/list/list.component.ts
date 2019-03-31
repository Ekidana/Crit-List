import { Component, OnInit, Input, HostListener } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/auth';
import { AngularFirestore } from '@angular/fire/firestore';
import { AlertController } from '@ionic/angular';
import { ConstantService } from 'src/app/providers/contstant/constant.service';

@Component({
  selector: 'app-list',
  templateUrl: './list.component.html',
  styleUrls: ['./list.component.scss'],
})
export class ListComponent implements OnInit {

  items = [];
  @Input('title') title: string;
  @Input('name') name: string;
  @Input('allowDone') allowDone: boolean;
  @Input('allowCrit') allowCrit: boolean;
  @Input('allowLater') allowLater: boolean;
  loading = true;

  constructor(private afAuth: AngularFireAuth, private db: AngularFirestore,
    private alertCtrl: AlertController, private constant: ConstantService,) {
    
  }

  ngOnInit() {
    this.afAuth.authState.subscribe(user => {
      if (!user)
        return;

      this.db.collection(`users/${this.afAuth.auth.currentUser.uid}/${this.name}`, ref => {
        let query = ref.orderBy('pos', 'desc');
        query = query.limit(this.constant.maxListSize);
        return query;
      }).snapshotChanges().subscribe(colSnap => {
        this.items = [];
        colSnap.forEach(a => {
          let item = a.payload.doc.data();
          item['id'] = a.payload.doc.id;
          this.items.push(item);
        });
        this.loading = false;
      });
    });
  }

  async add() {
    this.addOrEdit('New Task', val => this.handleAddItem(val.task));
  }

  async edit(item) {
    this.addOrEdit('Edit Task', val => this.handleEditItem(val.task, item), item);
  }

  async addOrEdit(header, handler, item?) {
    const alert = await this.alertCtrl.create({
      header,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
          handler: () => {
          }
        }, {
          text: 'Ok',
          handler,
        }
      ],
      inputs: [
        {
          name: 'task',
          type: 'text',
          placeholder: 'My task',
          value: item ? item.text : '',
        },
      ],
    });

    await alert.present();

    alert.getElementsByTagName('input')[0].focus();

    alert.addEventListener('keydown', (val => {
      if (val.keyCode === 13) {
        handler({task: val.srcElement['value']});
        alert.dismiss();
      }
    }));
  }

  handleAddItem(text: string) {
    if (!text.trim().length)
      return;

    let now = new Date();
    let nowUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(),
      now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds()));

    this.db.collection(`users/${this.afAuth.auth.currentUser.uid}/${this.name}`).add({
      text,
      pos: this.items.length ? this.items[0].pos + 1 : 0,
      created: nowUtc,
    });

    if (this.items.length >= this.constant.maxListSize)
      this.alertCtrl.create({
        header: 'Critical Oveload',
        subHeader: 'Too many important items!',
        message: `You have over ${this.constant.maxListSize} items in this list,
only showing the top ${this.constant.maxListSize}.`,
        buttons: ['Okay'],
      }).then(warning => {
        warning.present();
      });
  }

  handleEditItem(text: string, item) {
    this.db.doc(`users/${this.afAuth.auth.currentUser.uid}/${this.name}/${item.id}`).set({
      text,
    }, {merge: true});
  }

  delete(item) {
    this.db.doc(`users/${this.afAuth.auth.currentUser.uid}/${this.name}/${item.id}`).delete();
  }

  crit(item) {
    this.moveItem(item, 'crit');
  }

  complete(item) {
    this.moveItem(item, 'done');
  }

  later(item) {
    this.moveItem(item, 'later');
  }

  moveItem(item, list: string) {
    this.db.doc(`users/${this.afAuth.auth.currentUser.uid}/${this.name}/${item.id}`).delete();

    let id = item.id;
    delete item.id;

    this.db.collection(`users/${this.afAuth.auth.currentUser.uid}/${list}`, ref => {
      return ref.orderBy('pos', 'desc').limit(1);
    }).get().toPromise().then(qSnap => {
      item.pos = 0;
      qSnap.forEach(a => {
        item.pos = a.data().pos + 1;
      });
      this.db.doc(`users/${this.afAuth.auth.currentUser.uid}/${list}/${id}`).set(item);
    });
  }

  moveByOffset(index, offset) {
    this.db.doc(`users/${this.afAuth.auth.currentUser.uid}/${this.name}/${this.items[index].id}`).set({
      pos: this.items[index+offset].pos
    }, {merge: true});
    this.db.doc(`users/${this.afAuth.auth.currentUser.uid}/${this.name}/${this.items[index+offset].id}`).set({
      pos: this.items[index].pos
    }, {merge: true});
  }
}
