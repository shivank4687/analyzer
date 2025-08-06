import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ChromeService } from './chrome.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  title = 'stock-analysis-extension';
  constructor(private service: ChromeService) {}
  ngOnInit(): void {
    // this.service.priceObservable.subscribe((e) => {
    //   //console.log('initialappcomn', e);
    // });
    // this.service.latestPriceObservable.subscribe((e) => {
    //   //console.log('latest appcomn', e);
    // });
  }
}
