const allImages = [
  {
    src: "api/image/DIGISAM/257062",
    title: "Kupfer-Sammlung besonders zu F. P. Wilmsens Handbuch der ...",
    link: "https://digital.staatsbibliothek-berlin.de/werkansicht?PPN=PPN766734536&PHYSID=PHYS_0049",
  },
  {
    src: "api/image/DIGISAM/481252",
    title:
      "Unsere Feinde, wie sie einander lieben : kritische Äußerungen berühmter Franzosen, ...",
    link: "https://digital.staatsbibliothek-berlin.de/werkansicht?PPN=PPN680219498&PHYSID=PHYS_0119",
  },
  {
    src: "api/image/DIGISAM/536717",
    title: "Von der Wasserkante : Bilder vom Leben und Treiben an der ...",
    link: "https://digital.staatsbibliothek-berlin.de/werkansicht?PPN=PPN744086949&PHYSID=PHYS_0162",
  },
  {
    src: "api/image/DIGISAM/439242",
    title: "The Children's encyclopædia",
    link: "https://digital.staatsbibliothek-berlin.de/werkansicht?PPN=PPN745241239&PHYSID=PHYS_0372",
  },
  {
    src: "api/image/DIGISAM/382048",
    title:
      "150 colorirte Abbildungen der für den ersten Unterricht wichtigsten ...",
    link: "https://digital.staatsbibliothek-berlin.de/werkansicht?PPN=PPN744045967&PHYSID=PHYS_0062",
  },
  {
    src: "api/image/DIGISAM/509928",
    title:
      "Zwei Jahre an der Westfront : 323 Bilder aus Artois, Pikardie und ... , 1917",
    link: "https://digital.staatsbibliothek-berlin.de/werkansicht?PPN=PPN730458628&PHYSID=PHYS_0086",
  },
  {
    src: "api/image/DIGISAM/546639",
    title:
      "Wagner, Hermann: Entdeckungsreisen in Haus und Hof : mit seinen jungen Freunden unternommen , 1892",
    link: "https://digital.staatsbibliothek-berlin.de/werkansicht?PPN=PPN743643984&PHYSID=PHYS_0137",
  },
  {
    src: "api/image/DIGISAM/243141",
    title:
      "Kartiny iz estestvennoj istorii : s nazvanijami na trech jazykach , 1880",
    link: "https://digital.staatsbibliothek-berlin.de/werkansicht?PPN=PPN74407780X&PHYSID=PHYS_0015",
  },
  {
    src: "api/image/DIGISAM/216515",
    title:
      "Der kleine Rechenmeister in Bildern : zur Unterhaltung und Beschäftigung der Kinder , 1860",
    link: "https://digital.staatsbibliothek-berlin.de/werkansicht?PPN=PPN769901565&PHYSID=PHYS_0021",
  },
  {
    src: "api/image/DIGISAM/122323",
    title:
      "Deutschland in China : 1900 - 1901 ; bearbeitet von Teilnehmern an ... , 1902",
    link: "https://digital.staatsbibliothek-berlin.de/werkansicht?PPN=PPN610196898&PHYSID=PHYS_0132",
  },
  {
    src: "api/image/DIGISAM/454822",
    title: "Masterpieces selected from the Kōrin school , 1905",
    link: "https://digital.staatsbibliothek-berlin.de/werkansicht?PPN=PPN785977066&PHYSID=PHYS_0027",
  },
  {
    src: "api/image/DIGISAM/60803",
    title:
      "Baden-Powell, Baden Henry: Book IV: The Raiyatwárí and allied systems : being a manual of the land-tenures and of ... , 1892",
    link: "https://digital.staatsbibliothek-berlin.de/werkansicht?PPN=PPN664664326&PHYSID=PHYS_0015",
  },
  {
    src: "api/image/DIGISAM/570975",
    title:
      "Unzerreissbares Bilderbuch mit Bildern, Geschichten und Reimen : Illustr. von L[ina] Burger, Guido Hammer, ... , 1868",
    link: "https://digital.staatsbibliothek-berlin.de/werkansicht?PPN=PPN770469434&PHYSID=PHYS_0035",
  },
  {
    src: "api/image/DIGISAM/536235",
    title:
      "Kriegs-Zeitung der Gottfried Lindner A.-G., Wagen und Waggon-Fabrik, ... , 1915",
    link: "https://digital.staatsbibliothek-berlin.de/werkansicht?PPN=PPN747358893&PHYSID=PHYS_0003",
  },
  {
    src: "api/image/DIGISAM/116366",
    title:
      "Groot, Jan Jacob Maria: The religious system of China : its ancient forms, evolution, history and ... , 1897",
    link: "https://digital.staatsbibliothek-berlin.de/werkansicht?PPN=PPN658129929&PHYSID=PHYS_0153",
  },
  {
    src: "api/image/DIGISAM/287687",
    title:
      "Schubert, Gotthilf Heinrich: Naturgeschichte der Amphibien, Fische, Weich- und Schaalenthiere, ... : mit erklärendem Texte in dt. u. franz. ... , 1865",
    link: "https://digital.staatsbibliothek-berlin.de/werkansicht?PPN=PPN749903856&PHYSID=PHYS_0076",
  },
  {
    src: "api/image/DIGISAM/909433",
    title:
      "Wilhelm, Richard: Zwischen Himmel und Erde : von Luftfahrzeugen, von ihrer Erfindung, ... , 1909",
    link: "https://digital.staatsbibliothek-berlin.de/werkansicht?PPN=PPN745262686&PHYSID=PHYS_0180",
  },
  {
    src: "api/image/DIGISAM/654860",
    title: "Österreich-Ungarn im Weltkriege , 1915",
    link: "https://digital.staatsbibliothek-berlin.de/werkansicht?PPN=PPN736369724&PHYSID=PHYS_0041",
  },
  {
    src: "api/image/DIGISAM/290588",
    title: "Berlin, Nils Johann: Die Natur : ein Lesebuch für Schule und Haus , 1869",
    link: "https://digital.staatsbibliothek-berlin.de/werkansicht?PPN=PPN770334636&PHYSID=PHYS_0567",
  },
  {
    src: "api/image/DIGISAM/379389",
    title: "Matthes, Franz: Mineralogie , 1894",
    link: "https://digital.staatsbibliothek-berlin.de/werkansicht?PPN=PPN744076234&PHYSID=PHYS_0009",
  },
  {
    src: "api/image/DIGISAM/134568",
    title: "Reichenbach, Anton Benedikt: Erzählungen und Schilderungen vom Seelen- und Wanderleben, von der ... , 1894",
    link: "https://digital.staatsbibliothek-berlin.de/werkansicht?PPN=PPN74368723X&PHYSID=PHYS_0225"
  },
  {
    src: "api/image/DIGISAM/465393",
    title: "Wagner, Hermann: Illustrirtes Spielbuch für Knaben : 1200 unterhaltende und anregende ... , 1885",
    link: "https://digital.staatsbibliothek-berlin.de/werkansicht?PPN=PPN746035535&PHYSID=PHYS_0326"
  },
  {
    src: "api/image/DIGISAM/380544",
    title: "Wagner, H.: Entdeckungs-Reisen in der Wohnstube : mit seinen lieben jungen Freunden unternommen , 1866",
    link: "https://digital.staatsbibliothek-berlin.de/werkansicht?PPN=PPN743635604&PHYSID=PHYS_0094"
  },
  {
    src: "api/image/DIGISAM/73878",
    title: "Regierungs- und Intelligenzblatt für das Herzogtum Gotha , 1851",
    link: "https://digital.staatsbibliothek-berlin.de/werkansicht?PPN=PPN746331916&PHYSID=PHYS_0450"
  },
  {
    src: "api/image/DIGISAM/171528",
    title: "Adreß-Buch für die Provinzial-Hauptstadt Danzig und deren Vorstädte , 1886",
    link: "https://digital.staatsbibliothek-berlin.de/werkansicht?PPN=PPN823211177&PHYSID=PHYS_0481"
  },
  {
    src: "api/image/DIGISAM/99264",
    title: "Feldpost-Zeitung der Firma Fritz Pilgram, Baugeschäft, Köln-Mülheim , 1917",
    link: "https://digital.staatsbibliothek-berlin.de/werkansicht?PPN=PPN77137920X&PHYSID=PHYS_0017"
  },
  {
    src: "api/image/DIGISAM/590592",
    title: "Mitteilungen der Berliner Beamten-Vereinigung , 1899",
    link: "https://digital.staatsbibliothek-berlin.de/werkansicht?PPN=PPN746905629&PHYSID=PHYS_0226"
  },
  {
    src: "api/image/DIGISAM/353241",
    title: "Mitteilungen der Berliner Beamten-Vereinigung , 1900",
    link: "https://digital.staatsbibliothek-berlin.de/werkansicht?PPN=PPN746905637&PHYSID=PHYS_0420"
  },
  {
    src: "api/image/DIGISAM/501675",
    title: "Step, Edward: The little folks' picture natural history : first glimpses of the animal world , 1902",
    link: "https://digital.staatsbibliothek-berlin.de/werkansicht?PPN=PPN743976339&PHYSID=PHYS_0008"
  },
  {
    src: "api/image/DIGISAM/377200",
    title: "Reichlin-Meldegg, Adolfine: Alräunchens Kräuterbuch , 1885",
    link: "https://digital.staatsbibliothek-berlin.de/werkansicht?PPN=PPN770198201&PHYSID=PHYS_0021"
  },
  {
    src: "api/image/DIGISAM/253425",
    title: "Linke, Felix: Streifzüge im Reiche der Sterne , 1927",
    link: "https://digital.staatsbibliothek-berlin.de/werkansicht?PPN=PPN741452251&PHYSID=PHYS_0017"
  },
  {
    src: "api/image/DIGISAM/344212",
    title: "Ein Heimatgruß für unsere tapferen Brüder in Freud und Leid des ... , 1914",
    link: "https://digital.staatsbibliothek-berlin.de/werkansicht?PPN=PPN689362056&PHYSID=PHYS_0008"
  },
  {
    src: "api/image/DIGISAM/197830",
    title: "Alcock, Rutherford: Art and art industries in Japan , 1878",
    link: "https://digital.staatsbibliothek-berlin.de/werkansicht?PPN=PPN780078039&PHYSID=PHYS_0008"
  },
  {
    src: "api/image/DIGISAM/436080",
    title: "Demnach Ein Wohl-Edler Hochweiser Rath dieser Stadt, mit abermahligem ... : Publicatum Bremen, den 25. Septembris 1718 , 1718",
    link: "https://digital.staatsbibliothek-berlin.de/werkansicht?PPN=PPN626819857&PHYSID=PHYS_0010"
  },
  {
    src: "api/image/DIGISAM/372499",
    title: "Georgine , 1887",
    link: "https://digital.staatsbibliothek-berlin.de/werkansicht?PPN=PPN828406367&PHYSID=PHYS_0172"
  },
  {
    src: "api/image/DIGISAM/76861",
    title: "Krane, Anna Freiin: Der Träumer von Nazareth : Dismas ; zwei Legenden , 1915",
    link: "https://digital.staatsbibliothek-berlin.de/werkansicht?PPN=PPN717570649&PHYSID=PHYS_0001"
  }
];

export default allImages;
