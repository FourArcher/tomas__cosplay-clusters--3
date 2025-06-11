// Simple Image Stream
export class ImageStream {
    constructor() {
        // Image paths
        this.images = [
            '/assets/photos/unnamed (1).jpg',
            '/assets/photos/original_a3a882e254af6533bc15c8f7051d8202.jpg',
            '/assets/photos/scenes-day-3-ny-comic-92024603.webp',
            '/assets/photos/Pussy-riot.jpg',
            '/assets/photos/Press_PPHS-scaled.jpg',
            '/assets/photos/static-assets-upload7084230417647166708.webp',
            '/assets/photos/mega.webp',
            '/assets/photos/original_616db5e15130a1f9942447338cdbece6.jpg',
            '/assets/photos/original_ce60fd1ae0e28b8cadc5aa6f503e1522.jpg',
            '/assets/photos/original_7270045e993747fee8287bd7cfa9eec0.jpg',
            '/assets/photos/original_d28238009c7d2779628b8b47fdf159a1.jpg'
        ];

        // Create container
        this.container = document.createElement('div');
        this.container.className = 'image-stream';
        
        // Create track
        this.track = document.createElement('div');
        this.track.className = 'image-track';
        this.container.appendChild(this.track);

        // Add to body
        document.body.appendChild(this.container);

        // Configuration
        this.width = '20vw'; // Default width
        this.speed = 75; // Adjusted speed (pixels per second)

        // Build initial stream
        this.buildStream();
    }

    buildStream() {
        // Clear existing content
        this.track.innerHTML = '';

        // Shuffle images
        const shuffledImages = [...this.images].sort(() => Math.random() - 0.5);

        // Create two sequences for seamless loop
        const sequence1 = document.createElement('div');
        const sequence2 = document.createElement('div');
        sequence1.className = 'image-sequence';
        sequence2.className = 'image-sequence';

        // Calculate how many images we need
        const screenWidth = window.innerWidth;
        const itemWidth = this.width === '100vh' ? window.innerHeight : (parseInt(this.width) / 100) * screenWidth;
        const itemsPerScreen = Math.ceil(screenWidth / itemWidth);
        const totalItems = itemsPerScreen * 2; // Double for smooth loop

        // Fill sequences
        for (let i = 0; i < totalItems; i++) {
            const img = document.createElement('img');
            img.src = shuffledImages[i % shuffledImages.length];
            img.className = 'stream-image';
            img.style.width = this.width;
            img.style.mixBlendMode = 'difference';
            img.loading = 'lazy';
            
            // Add to both sequences
            sequence1.appendChild(img.cloneNode(true));
            sequence2.appendChild(img.cloneNode(true));
        }

        // Add sequences to track
        this.track.appendChild(sequence1);
        this.track.appendChild(sequence2);

        // Start animation
        this.startAnimation();
    }

    startAnimation() {
        const sequences = this.track.querySelectorAll('.image-sequence');
        if (sequences.length === 0) return;

        const sequenceWidth = sequences[0].offsetWidth;
        const duration = sequenceWidth / this.speed;

        // Position second sequence
        sequences[1].style.transform = `translateX(${sequenceWidth}px)`;

        // Start animation
        sequences.forEach(seq => {
            seq.style.animation = `scroll-left ${duration}s linear infinite`;
        });
    }

    setWidth(width) {
        this.width = width;
        this.container.style.width = width;
        this.buildStream();
    }

    show() {
        this.container.classList.add('show');
        this.buildStream();
    }

    hide() {
        this.container.classList.remove('show');
    }
} 