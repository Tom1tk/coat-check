export function useCoatAdvice() {
    const getCoatAdvice = (
        temp: number,
        rain: number,
        condition: string,
        isMorningOrAfternoon: boolean = false,
        otherTemp?: number,
        otherRain?: number
    ): string => {
        let coatAdvice = 'No need to bring a coat';

        if (isMorningOrAfternoon) {
            if (rain > 0 || (otherRain && otherRain > 0) || temp < 10 || (otherTemp && otherTemp < 10)) {
                coatAdvice = 'Bring a coat';
            } else if (
                (temp >= 10 && temp <= 15 && condition === 'Cloudy') ||
                (otherTemp && otherTemp >= 10 && otherTemp <= 15 && condition === 'Cloudy') // Simplified logic, condition check might need refinement if conditions differ
            ) {
                coatAdvice = 'Coat recommended but not necessary';
            }
        } else {
            // Current hour logic
            if (rain > 0 || temp < 10) {
                coatAdvice = 'Bring a coat';
            } else if (temp >= 10 && temp <= 15 && condition === 'Cloudy') {
                coatAdvice = 'Coat recommended but not necessary';
            }
        }

        return coatAdvice;
    };

    return { getCoatAdvice };
}
