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
    summary: "20 yasinda, Hacettepe Universitesinde okuyor. Yogun ders programi var ve duzenli calisma rutini kurmakta zorlaniyor.",
    role: "Sen, AI ile calisma planlama app'ini anlatan ama asil problemi kesfetmeye calisan oyuncusun.",
    focus: "Tool ihtiyaci gibi duran istegin altinda plan yapip birakma ve dikkat daginikligi olup olmadigini ortaya cikar."
  },
  {
    id: "fake_interest",
    title: "Ayşe / Ankara Ataturk Lisesi",
    kicker: "Senaryo 2",
    summary: "17 yasinda, Ankara Ataturk Lisesinde okuyor. Sinav senesinde ve mevcut not duzenini bozmak istemiyor.",
    role: "Sen, ilgiyi gercek talep sanmadan once mevcut sistemi ve switching cost'u sorgulayan oyuncusun.",
    focus: "Asil problemin planlama degil zaman baskisi ve yeni bir sistem ogrenme maliyeti oldugunu cikar."
  },
  {
    id: "hard_mode",
    title: "Aslı / Bozyazi Anadolu Lisesi",
    kicker: "Senaryo 3",
    summary: "18 yasinda, Bozyazi Anadolu Lisesinde son sinif ogrencisi. Okul, deneme ve odev temposu arasinda sikismis hissediyor.",
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
    "Amac urunu satmak degil; kullanicinin gercekten tool problemi mi, yoksa daha derin bir problem mi yasadigini bulmak.",
  details: [
    "Ders ve hedef bazli kisisel calisma plani olusturur.",
    "Gunluk takip, hatirlatma ve tekrar rutini kurmaya yardim eder.",
    "Verimlilik, odak ve ilerleme hissini artirma sozu verir."
  ]
};

const lockedPlaceholders = Array.from({ length: 2 }, (_, index) => index);

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
          className={`step-dot ${flowStep === "select" ? "is-active" : "is-complete"}`}
          aria-label="1. Hikaye sec"
        />
        <div
          className={`step-dot ${flowStep === "details" ? "is-active" : ""}`}
          aria-label="2. Hikaye detaylari"
        />
        <div className="step-dot is-muted" aria-label="3. Oyuna basla" />
      </div>

      {flowStep === "select" ? (
        <>
          <h1 className="hero-title">Ilk olarak hikayeni sec.</h1>

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
            {lockedPlaceholders.map((item) => (
              <div key={item} className="scenario-chip is-locked locked-placeholder">
                <span className="locked-placeholder-icon">􀎠</span>
              </div>
            ))}
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
              <span>Uygulama ne sunuyor</span>
              <strong>{appOption.summary}</strong>
              <ul className="detail-list">
                {appOption.details.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="scenario-detail-card">
              <span>Neyi test ediyorsun</span>
              <strong>{appOption.role}</strong>
              <p>{appOption.focus}</p>
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
