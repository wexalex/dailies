/*
 * DAILIES Seiten-Konfiguration
 * Cases und Pricing werden von index.html aus diesem Objekt gerendert.
 * Neue Cases oder Preisänderungen: nur diese Datei anpassen.
 */
window.DAILIES = {

  /* ---------- Cases (Sektion "Referenzen") ----------
   * tag: "Employer Brand" | "Produkt" | "Brand"
   * image: Pfad zu Thumbnail/Standbild (16:9). Leer = gestrichelter Platzhalter.
   * video: optionaler Pfad zu einem MP4 (ersetzt das Bild).
   * testimonial: { quote, name, role } - wird nur gerendert, wenn quote nicht leer ist.
   */
  cases: [
    {
      name: "F/LIST",
      tag: "Employer Brand", // TODO: Ziel-Tag bestätigen
      text: "[TEXT FOLGT]", // TODO: 1 Satz zum Case
      image: "",
      video: "",
      testimonial: { quote: "", name: "", role: "" }
    },
    {
      name: "Sparkasse Oberösterreich",
      tag: "Brand", // TODO: Ziel-Tag bestätigen
      text: "[TEXT FOLGT]", // TODO: 1 Satz zum Case
      image: "",
      video: "",
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
   * Feature-Werte: String = Text, true = Häkchen, false = Strich.
   */
  pricing: {
    featureLabels: [
      "Postings pro Woche",
      "Reels (9:16)",
      "Fotos (16:9 + 9:16)",
      "Titelbilder",
      "Untertitel",
      "Rohmaterial",
      "Postings aufbereitet",
      "Planung (PrePro)",
      "Dreh",
      "Post",
      "Feedbackschleifen pro Asset",
      "Kanäle",
      "Publishing",
      "Paid und Collabs",
      "Community Management",
      "Inhouse-Workshop"
    ],
    plans: [
      {
        id: "start",
        name: "Start",
        tagline: "Der Grundtakt",
        highlighted: false,
        price: "€ 1.290",
        priceSub: "€ 3.870 pro Quartal verrechnet",
        priceNote: "Jahr im Voraus: € 12.500 (-19 %)",
        cta: { label: "Probe-Contenttag anfragen", href: "mailto:office@wexplore.at?subject=Gratis%20Probe-Contenttag" },
        features: ["2", "13 / Quartal", "36 / Quartal", false, true, false, false, "0,5 Tage", "1 ganzer Drehtag, 2 Personen", "2,5 Tage", "1", "Instagram", false, false, false, false]
      },
      {
        id: "grow",
        name: "Grow",
        tagline: "Mehr Formate, zwei Kanäle",
        highlighted: true,
        price: "€ 2.690",
        priceSub: "€ 8.070 pro Quartal verrechnet",
        priceNote: "",
        cta: { label: "Probe-Contenttag anfragen", href: "mailto:office@wexplore.at?subject=Gratis%20Probe-Contenttag" },
        features: ["3", "30 / Quartal", "72 / Quartal", "30 / Quartal", true, false, false, "1 Tag", "3 Halbtage über das Quartal verteilt, 2 Personen", "5 Tage", "2", "Instagram, LinkedIn", false, false, false, true]
      },
      {
        id: "scale",
        name: "Scale",
        tagline: "Euer externes Content-Team",
        highlighted: false,
        price: "€ 4.990",
        priceSub: "€ 15.000 pro Quartal verrechnet",
        priceNote: "",
        cta: { label: "Scope besprechen", href: "mailto:office@wexplore.at?subject=DAILIES%20Scale%20-%20Scope%20besprechen" },
        features: ["5", "Individuell", "Individuell", "Individuell", true, true, true, "2 Tage", "3 ganze Drehtage, 3 Personen", "7 Tage", "4", "Instagram, TikTok, LinkedIn", true, true, false, false]
      }
    ]
  }
};
