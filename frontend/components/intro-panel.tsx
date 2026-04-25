"use client";

import { useMemo } from "react";
import { Scenario } from "../lib/types";

type ScenarioOption = {
  id: Scenario;
  title: string;
  kicker: string;
  summary: string;
  role: string;
  focus: string;
};

type IntroPanelProps = {
  scenario: Scenario;
  flowStep: "select" | "details";
  onScenarioChange: (scenario: Scenario) => void;
  onContinue: () => void;
  onBack: () => void;
  onStart: () => void;
  starting: boolean;
  visualsLoading: boolean;
};

const scenarioOptions: ScenarioOption[] = [
  {
    id: "motivasyon",
    title: "Nehir/ Hacettepe Universitesi",
    kicker: "Senaryo 1",
    summary: "Yuzeyde AI planlama ister gibi gorunen ama aslen disiplin ve aliskanlik problemi yasayan ogrenci.",
    role: "Sen, AI ile calisma planlama app'ini anlatan ama asil problemi kesfetmeye calisan oyuncusun.",
    focus: "Tool ihtiyaci gibi duran istegin altinda plan yapip birakma ve dikkat daginikligi olup olmadigini ortaya cikar."
  },
  {
    id: "fake_interest",
    title: "Ayşe / Ankara Ataturk Lisesi",
    kicker: "Senaryo 2",
    summary: "Mantikli sekilde olumlu gorunen ama gercekte yeni tool'a gecmeye vakti olmayan tip ogrencisi.",
    role: "Sen, ilgiyi gercek talep sanmadan once mevcut sistemi ve switching cost'u sorgulayan oyuncusun.",
    focus: "Asil problemin planlama degil zaman baskisi ve yeni bir sistem ogrenme maliyeti oldugunu cikar."
  },
  {
    id: "hard_mode",
    title: "Aslı / Bozyazi Anadolu Lisesi",
    kicker: "Senaryo 3",
    summary: "Verimli olmaya takilmis ama derindeki sorunu kendi de netlestiremeyen final senesi ogrenci.",
    role: "Sen, belirsiz verimlilik sikayetinin altindaki mental load ve karar yorgunlugunu bulmaya calisan oyuncusun.",
    focus: "Gunluk akisi, son verimli gunu ve onu durduran seyleri deserek gercek sikismayi ortaya cikar."
  }
];

const appOption = {
  title: "AI Study Tool",
  kicker: "Urun 01",
  summary:
    "AI ile sana ozel calisma plani yapan, seni takip eden ve verimini artirmayi vadeden uygulama.",
  role:
    "Sen, bu urunun gercekten ihtiyac olup olmadigini anlamaya calisan oyuncusun.",
  focus:
    "Amac urunu satmak degil; kullanicinin gercekten tool problemi mi, yoksa daha derin bir problem mi yasadigini bulmak."
};

export function IntroPanel({
  scenario,
  flowStep,
  onScenarioChange,
  onContinue,
  onBack,
  onStart,
  starting,
  visualsLoading
}: IntroPanelProps) {
  const activeScenario = useMemo(
    () => scenarioOptions.find((item) => item.id === scenario) ?? scenarioOptions[0],
    [scenario]
  );

  return (
    <section className="panel hero-panel">
      <div className="eyebrow">WIRO AI / HIKAYE AKISI</div>

      <div className="stepper-row" aria-label="Akis adimlari">
        <div
          className={`step-pill ${flowStep === "select" ? "is-active" : "is-complete"}`}
        >
          1. Hikaye sec
        </div>
        <div className={`step-pill ${flowStep === "details" ? "is-active" : ""}`}>
          2. Hikaye detaylari
        </div>
        <div className="step-pill is-muted">3. Oyuna basla</div>
      </div>

      {flowStep === "select" ? (
        <>
          <h1 className="hero-title">Ilk olarak hikayeni sec.</h1>
          <p className="hero-copy">
            Bu oyunda tek bir urun var: AI destekli study tool. Ilk adimda urunu
            seciyorsun, ikinci adimda ise hangi tip kullaniciyla konusacagini belirliyorsun.
          </p>

          <div className="scenario-strip">
            <button
              className="scenario-chip is-active"
              type="button"
              aria-pressed="true"
            >
              <span className="scenario-chip-kicker">{appOption.kicker}</span>
              <strong className="scenario-chip-title">{appOption.title}</strong>
              <p className="scenario-chip-copy">{appOption.summary}</p>
              <small className="scenario-chip-badge">Tek urun</small>
            </button>
          </div>

          <div className="cta-row">
            <button
              className="primary-button"
              onClick={onContinue}
              type="button"
            >
              Devam et
            </button>
          </div>
        </>
      ) : (
        <>
          <h1 className="hero-title">Gorusme akisini sec.</h1>
          <p className="hero-copy">
            Urun sabit, ama gorusmenin akisi degisiyor. Asagida istedigin
            gorusmeyi secip oyunu baslat.
          </p>

          <div className="mic-notice">
            Oyun sesli baslar. Tarayici mikrofon izni isteyecek ve karakter ilk cumleyi sesli soyleyecek.
          </div>

          <div className="scenario-strip">
            {scenarioOptions.map((item) => {
              const isSelected = item.id === activeScenario.id;

              return (
                <button
                  key={item.id}
                  className={`scenario-chip ${isSelected ? "is-active" : "is-muted"}`}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onScenarioChange(item.id)}
                >
                  <span className="scenario-chip-kicker">{item.kicker}</span>
                  <strong className="scenario-chip-title">{item.title}</strong>
                  <p className="scenario-chip-copy">{item.summary}</p>
                  <small className="scenario-chip-badge">Gorusme</small>
                </button>
              );
            })}
          </div>

          <div className="scenario-detail">
            <div className="scenario-detail-card role-card">
              <span>Senin rolun</span>
              <strong>{appOption.role}</strong>
            </div>

            <div className="scenario-detail-card">
              <span>Hikaye odagi</span>
              <p>{appOption.focus}</p>
            </div>
          </div>

          <div className="detail-summary-grid">
            <div className="scenario-detail-card compact">
              <span>Gorsel durum</span>
              <strong>{visualsLoading ? "Hazirlaniyor" : "Hazir"}</strong>
            </div>
          </div>

          <div className="cta-row">
            <div className="cta-group">
              <button className="ghost-button" onClick={onBack} type="button">
                Geri don
              </button>
              <button className="primary-button" onClick={onStart} disabled={starting} type="button">
                {starting ? "Sesli gorusme hazirlaniyor..." : "Sesli gorusmeyi baslat"}
              </button>
            </div>
            <div className="background-status">
              <span className={`status-dot ${visualsLoading ? "pending" : "ready"}`} />
              {visualsLoading ? "Karakter gorselleri hazirlaniyor" : "Karakter gorselleri hazir"}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
