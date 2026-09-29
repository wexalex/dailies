/*
 * DAILIES Seiten-Konfiguration
 * Cases und Pricing werden von index.html aus diesem Objekt gerendert.
 * Neue Cases oder Preisänderungen: nur diese Datei anpassen.
 */
window.DAILIES = {

  /* ---------- Lead-Magnet-Flow ("Content-Ideen entdecken") ----------
   * Der Flow ist ausdruecklich KEINE Terminbuchung. Interessent:innen bewerben sich
   * fuer die Moeglichkeit eines Probe-Content-Tags, danach schlagen wir ein
   * 30-minuetiges Briefing vor.
   *
   * uebermittlung.endpoint: solange null, zeigt der Flow KEINE Erfolgsmeldung,
   * sondern oeffnet eine fertig ausgefuellte E-Mail und sagt, dass die Bewerbung
   * erst mit dem Senden dort raus ist. Es wird keine Uebermittlung vorgetaeuscht.
   * Sobald ein Endpunkt eingetragen ist, wird per JSON gepostet und die
   * Erfolgsmeldung erscheint erst nach einer erfolgreichen Antwort.
   */
  flow: {
    uebermittlung: {
      endpoint: null,          // TODO: Formular-Endpunkt oder CRM-Webhook eintragen
      methode: "POST",
      fallbackEmail: "office@wexplore.at"
    }
  },


  /* ---------- Cases (Sektion "Referenzen") ----------
   * tag: "Employer Brand" | "Produkt" | "Brand"
   * image: Pfad zu Thumbnail/Standbild (16:9). Leer = gestrichelter Platzhalter.
   * video: optionaler Pfad zu einem MP4 (ersetzt das Bild).
   * href: optionaler Link zur Projektseite (projekte/...) - erzeugt "Zur Projektseite".
   * testimonial: { quote, name, role } - wird nur gerendert, wenn quote nicht leer ist.
   *
   * ACHTUNG, zweite Stelle: in index.html steht im <div data-cases> dieselbe Liste
   * noch einmal als Markup, damit Suchmaschinen und Link-Vorschauen die Namen sehen.
   * Wer hier einen Case ergaenzt, umbenennt oder entfernt, muss ihn dort mitziehen.
   */
  cases: [
    {
      name: "F/LIST",
      tag: "Employer Brand", // TODO: Ziel-Tag bestätigen
      text: "Content Week: drei Produktionstage, fünf Content-Säulen, 20-30 Assets für ein ganzes Quartal.",
      image: "",
      video: "",
      href: "projekte/flist-content-week.html",
      testimonial: { quote: "", name: "", role: "" }
    },
    {
      name: "Sparkasse Oberösterreich",
      tag: "Brand", // TODO: Ziel-Tag bestätigen
      text: "Homestories: eine fünfteilige Serie - pro Episode ein Drehtag, ausgespielt über mehrere Kanäle und Wochen.",
      image: "assets/projekte/sparkasse/teaser-quer-poster.jpg",
      video: "",
      href: "projekte/sparkasse-homestories.html",
      testimonial: { quote: "", name: "", role: "" }
    },
    {
      name: "APG",
      tag: "Brand", // TODO: Ziel-Tag bestätigen
      text: "[TEXT FOLGT]", // TODO: 1 Satz zum Case
      image: "",
      video: "",
      testimonial: { quote: "", name: "", role: "" }
    }
  ],

  /* ---------- Pricing (Sektion "Pakete") ----------
   * Werte 1:1 von der Live-Seite übernommen (Stand 23.09.2026).
   * 28.09.2026: Zeile "Postings aufbereitet" auf Wunsch von WEXPLORE gestrichen,
   * Zeile "Post" heisst jetzt "Schnitt" (Werte unveraendert).
   * 28.09.2026: Preise auf runde Zahlen, Entscheidung WEXPLORE: 1.500 / 2.700 / 5.000.
   * Feature-Werte: String = Text, true = Häkchen, false = Strich.
   *
   * ACHTUNG, zwei weitere Stellen in index.html: die Liste [data-table-fallback]
   * direkt über der Tabelle und die FAQ-Antwort "Was kostet Dailies für ein kleines
   * Unternehmen?". Beide nennen Preise im Markup, damit Suchmaschinen und
   * Link-Vorschauen sie überhaupt sehen. Jede Preisänderung hier muss dort mit.
   *
   * Quartalspreis ist bei allen Paketen exakt das Dreifache des Monatspreises.
   */
  pricing: {
    featureLabels: [
      "Postings pro Woche",
      "Reels (9:16)",
      "Fotos (16:9 + 9:16)",
      "Titelbilder",
      "Untertitel",
      "Rohmaterial",
      "Planung (PrePro)",
      "Dreh",
      "Schnitt",
      "Feedbackschleifen pro Asset",
      "Kanäle"
    ],
    plans: [
      {
        id: "start",
        name: "Start",
        tagline: "Der Grundtakt",
        highlighted: false,
        price: "€ 1.500",
        priceSub: "€ 4.500 pro Quartal verrechnet",
        priceNote: "",
        cta: { label: "Probe-Contenttag anfragen", href: "mailto:office@wexplore.at?subject=Gratis%20Probe-Contenttag" },
        features: ["2", "13 / Quartal", "36 / Quartal", false, true, false, "0,5 Tage", "1 ganzer Drehtag, 2 Personen", "2,5 Tage", "1", "Instagram"]
      },
      {
        id: "grow",
        name: "Grow",
        tagline: "Mehr Formate, zwei Kanäle",
        highlighted: true,
        price: "€ 2.700",
        priceSub: "€ 8.100 pro Quartal verrechnet",
        priceNote: "",
        cta: { label: "Probe-Contenttag anfragen", href: "mailto:office@wexplore.at?subject=Gratis%20Probe-Contenttag" },
        features: ["3", "30 / Quartal", "72 / Quartal", "30 / Quartal", true, false, "1 Tag", "3 Halbtage über das Quartal verteilt, 2 Personen", "5 Tage", "2", "Instagram, LinkedIn"]
      },
      {
        id: "scale",
        name: "Scale",
        tagline: "Euer externes Content-Team",
        highlighted: false,
        price: "€ 5.000",
        priceSub: "€ 15.000 pro Quartal verrechnet",
        priceNote: "",
        cta: { label: "Scope besprechen", href: "mailto:office@wexplore.at?subject=DAILIES%20Scale%20-%20Scope%20besprechen" },
        features: ["5", "Individuell", "Individuell", "Individuell", true, true, "2 Tage", "3 ganze Drehtage, 3 Personen", "7 Tage", "4", "Instagram, TikTok, LinkedIn"]
      }
    ]
  }
};
