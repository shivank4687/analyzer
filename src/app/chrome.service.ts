import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { MessageType } from '../config/enums/event-messages';

@Injectable({
  providedIn: 'root',
})
export class ChromeService {
  private priceUpdates$ = new Subject<any[]>();
  private latestPriceUpdate$ = new Subject<any[]>();
  private readonly STORAGE_KEY = MessageType.PRICE_UPDATE;
  constructor() {
    this.initRealtimeListener();
    this.loadInitialUpdates();
  }
  get priceObservable() {
    return this.priceUpdates$.asObservable();
  }
  get latestPriceObservable() {
    return this.latestPriceUpdate$.asObservable();
  }

  private async loadInitialUpdates() {
    const data = await this.getUpdates();
    this.priceUpdates$.next(data);
  }

  private initRealtimeListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === MessageType.PRICE_UPDATE) {
        this.latestPriceUpdate$.next(message.payload);
      }
    });
  }

  async getUpdates<T = any[]>(): Promise<T> {
    return new Promise((resolve) => {
      chrome.storage.local.get([this.STORAGE_KEY], (result) => {
        resolve(result[this.STORAGE_KEY] || []);
      });
    });
  }
}
