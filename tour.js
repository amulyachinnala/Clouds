const show_tour = false;

// Initialize the driver (the tool that makes the tour)
const driver = window.driver.js.driver;

// Get the current page name (e.g., "home.html")
const currentPage = window.location.pathname;

if (show_tour) {

    // ------------------------------------------------
    // TOUR PART 1: THE HOME PAGE
    // ------------------------------------------------
    if (currentPage.includes("home.html")) {
        
        const homeTour = driver({
            showProgress: true,
            steps: [
                { 
                    element: '.main-title', 
                    popover: { title: 'Welcome to Cloud', description: 'This is your main dashboard.' } 
                },
                { 
                    element: '.nav-bar', 
                    popover: { title: 'Navigation', description: 'Use these tabs to switch between your different apps.' } 
                },
                { 
                    element: 'a[href="budget.html"]', 
                    popover: { 
                        title: 'Next Stop: Budget', 
                        description: 'Click next to learn about the Budget tracker.',
                        side: "bottom", 
                        align: 'start'
                    } 
                }
            ],
            onDestroyStarted: () => {
                if (!homeTour.hasNextStep()) {
                    window.location.href = 'budget.html?tour=true';
                }
            }
        });

        homeTour.drive();
    }

    // ------------------------------------------------
    // TOUR PART 2: THE BUDGET PAGE
    // ------------------------------------------------
    if (currentPage.includes("budget.html") && window.location.search.includes("tour=true")) {

        const budgetTour = driver({
            showProgress: true,
            steps: [
                { 
                    element: '.main-title', 
                    popover: { title: 'Budget Tracker', description: 'Here is where you can track your income and expenses.' } 
                },
                { 
                    element: '.nav-bar', 
                    popover: { title: 'Task Manager', description: 'Click next to see your Tasks.' } 
                }
            ],
            onDestroyStarted: () => {
                 if (!budgetTour.hasNextStep()) {
                    window.location.href = 'task.html?tour=true';
                }
            }
        });

        budgetTour.drive();
    }

    // ------------------------------------------------
    // TOUR PART 3: THE TASK PAGE
    // ------------------------------------------------
    if (currentPage.includes("task.html") && window.location.search.includes("tour=true")) {

        const taskTour = driver({
            showProgress: true,
            steps: [
                { 
                    element: '.main-title', 
                    popover: { title: 'Task Manager', description: 'Keep track of your daily to-dos here.' } 
                },
                { 
                    popover: { title: 'All Set!', description: 'You are now ready to use Cloud. Enjoy!' } 
                }
            ]
        });

        taskTour.drive();
    }
}