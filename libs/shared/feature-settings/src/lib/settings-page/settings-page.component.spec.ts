import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SettingsPage } from './settings-page.component';

describe('SettingsPage', () => {
  let fixture: ComponentFixture<SettingsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SettingsPage] }).compileComponents();
    fixture = TestBed.createComponent(SettingsPage);
  });

  it('should create', () => expect(fixture.componentInstance).toBeTruthy());
});
