interface TemperatureReading {
  date: Date;
  timestamp: string;
  temperature: number;
  hour: number;
}

class WeatherOpenMateo {
  private baseUrl: string;
  private latitude: number;
  private longitude: number;
  private query: string;
  private url: string;
  private weatherData: any;
  private mappedTemperatureData: TemperatureReading[];

  constructor() {
    this.baseUrl = 'https://api.open-meteo.com/v1';
    this.latitude = 36.302564114392815;
    this.longitude = -115.2946230730017;
    this.query = `/forecast?latitude=${this.latitude}&longitude=${this.longitude}&hourly=temperature_2m&timezone=America%2FLos_Angeles&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&daily=sunrise,sunset`;
    this.url = `${this.baseUrl}${this.query}`;
    this.weatherData = null;
    this.mappedTemperatureData = [];
  }

  async getWeatherData() {
    if (this.weatherData) {
      return this.weatherData;
    }
    const response = await fetch(this.url);
    const data = await response.json();
    console.log(data);
    this.weatherData = data;
    return data;
  }

  async mapTemperatureData(): Promise<TemperatureReading[]> {
    const weatherData = await this.getWeatherData();
    this.mappedTemperatureData = weatherData.hourly.time.map((timestamp: string, index: number) => {
      const date = new Date(timestamp);
      return {
        date,
        timestamp,
        temperature: weatherData.hourly.temperature_2m[index],
        hour: date.getHours(),
      };
    });
    return this.mappedTemperatureData;
  }

  async getTemperatureAtHour(targetDate: Date): Promise<TemperatureReading> {
    if (!this.mappedTemperatureData) {
      await this.mapTemperatureData();
    }
    const currentTemperature = this.mappedTemperatureData.find(
      ({ date }) =>
        date.getFullYear() === targetDate.getFullYear() &&
        date.getMonth() === targetDate.getMonth() &&
        date.getDate() === targetDate.getDate() &&
        date.getHours() === targetDate.getHours()
    );
    if (!currentTemperature) {
      this.weatherData = null;
      return this.getTemperatureAtHour(targetDate);
    }
    return currentTemperature;
  }
}

export { WeatherOpenMateo };
