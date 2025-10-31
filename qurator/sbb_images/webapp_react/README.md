# Stabi Image Search (Beta)

React-based image similarity search for Berlin State Library's Digitized Collections. There are three ways to search:
- **Image uploads** - Start with an image to find visually similar images
- **Text descriptions** - Search by describing an image content in multiple languages
- **Document IDs (PPNs)** - Browse all images within a specific document

## Quick Start
```bash
# Install dependencies
npm install

# Start development server
npm start
```

## Project Structure
```
src/
├── components/          # Reusable UI components
│   ├── Header.js        # Fixed navigation
│   ├── Tabs.js          # Search interface container
│   ├── SearchResults.js # Results grid with infinite scroll
│   ├── SearchState.js   # Central search state management
│   └── ...
├── pages/               
│   ├── LandingPage.js   # Main search interface
│   ├── SearchResultsPage.js # Results display
│   ├── AboutPage.js     # Documentation
│   └── SearchFor.js     # URL-based search handler
├── data/                # Static data
│   ├── imageData.js     # Example images for the landing page
│   ├── descriptionSuggestions.js # 50 search examples
│   └── ppnSuggestions.js # Example PPNs
├── styles/              # CSS with design tokens
│   ├── tokens.css       # Official SBB design system
│   ├── project-tokens.css # Project extensions
│   └── *.css            # Component styles
├── assets/              # Static assets
│   └── SBB_Logo.svg     # Berlin State Library logo
├── index.js             # React root entry point
└── App.js               # Main app component with routing

public/
├── index.html           # HTML template
└── images/              # Static images for About page
    ├── cropper.png
    └── cropper2.png
```

## Tech Stack
- **React 18** with React Router for navigation
- **react-cropper** for image region selection
- **Font Awesome** (free) for icons
- **CSS** with design tokens (no frameworks)
- Custom API integration for search functionality

### Search State Management
`SearchState.js` -handles core search logic

### API Integration
API calls are made in the following locations:

**SearchState.js** - Core search operations
- Image similarity search
- Text-based search  
- Document (PPN) lookup

**SearchResults.js** - Fetching metadata for result cards
- Document links
- Image titles

**RandomImages.js** - Fetching titles for example images on landing page

### Routing Structure
- `/` - **LandingPage.js**: Initial search interface
- `/search-results` - **SearchResultsPage.js**: Results display with infinite scroll
- `/searchfor` - **SearchFor.js**: Enables shareable search URLs. Reads query params, creates search state, navigates to results page.
- `/about` - **AboutPage.js**: Documentation

### Component Organization

**Search Interface:**
- `Tabs.js` - Tab navigation container
- `ImageTab.js` - Drag-and-drop upload (landing page)
- `ResultsImageTab.js` - Collapsible image tab for the results page (to save space)
- `DescriptionTab.js` - Text search with suggestions
- `PPNTab.js` - Document ID search with suggestions

**Results Display:**
- `SearchResults.js` - Results grid with infinite scroll (loads 100 results per batch)
- `MinimizedSearchBar.js` - Sticky search summary (appears when scrolling)
- `SearchSimilarImages.js` - "Search similar" button on result cards, starts a new image search

**UI Components:**
- `Header.js` - Fixed navigation header
- `HelpModal.js` - Tabbed help documentation
- `ShareButton.js` - Share search URL
- `RandomImages.js` - Example images on landing page (16 in total, randomized, from a pre-selected list found in data/imageData.js)

### Styling Architecture

**Design Tokens:**
- `tokens.css` - Official design system tokens
- `project-tokens.css` - Project-specific extensions (colors from the SBB Design System that are not in tokens.css)

**Unusual CSS: Tabs Navigation**
The tabs use a specific visual effect requiring hardcoded structure:
- Meant to reference library index cards 
- 3D perspective transforms create depth effect
- Z-index layering for overlap
- Active tab has white background, others colored
- Tab hover changes to olive color
- Structure is fragile - modify carefully.
See `Tabs.css` for implementation details.

### Key Data Files
- `imageData.js` - Example images for landing page
- `descriptionSuggestions.js` - Search suggestions in various languages (50 examples)
- `ppnSuggestions.js` - Some PPNs suggestions to see how this works

## Accessibility
- ARIA labels on interactive elements 
- Keyboard navigation support
- Focus-visible outlines 

### Known Accessibility Gaps
- Missing aria-live regions for dynamic content updates
- Cropper tool lacks keyboard instructions


