import React, { useState, useEffect, useRef, useMemo, forwardRef } from 'react'
import { Card, Row, Col, Typography, Spin, Space, Button, Tag, ConfigProvider, theme, Switch, App as AntApp, notification } from 'antd'
import { EnvironmentOutlined, CloudOutlined, ThunderboltOutlined, SearchOutlined, MoonOutlined, SunOutlined } from '@ant-design/icons'
import axios from 'axios'
import SparklesCore from './components/SparklesCore'
import './App.css'

const { Title, Text } = Typography;

// Türkiyenin popüler şehirleri (geçici olarak kullanılacak)
const popularCities = [
  { value: 'İstanbul' },
  { value: 'Ankara' },
  { value: 'İzmir' },
  { value: 'Antalya' },
  { value: 'Bursa' },
  { value: 'Adana' },
  { value: 'Konya' },
  { value: 'Kayseri' },
  { value: 'Trabzon' },
  { value: 'Eskişehir' }
];

// Dünya şehirleri (geçici olarak kullanılacak)
const worldCities = [
  { value: 'London' },
  { value: 'New York' },
  { value: 'Paris' },
  { value: 'Tokyo' },
  { value: 'Berlin' },
  { value: 'Rome' },
  { value: 'Madrid' },
  { value: 'Dubai' },
  { value: 'Moscow' },
  { value: 'Amsterdam' }
];

// SparklesCore'u React.memo ile sarmalayarak gereksiz yeniden render'ı engelle
const MemoizedSparklesCore = React.memo(SparklesCore);

// Uygulamanın ana bileşeni
function App() {
  const [city, setCity] = useState('')
  const [options, setOptions] = useState([])
  const [weatherData, setWeatherData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [inputValue, setInputValue] = useState('')
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [darkMode, setDarkMode] = useState(localStorage.getItem('darkMode') === 'true' || false)
  const searchRef = useRef(null)
  const searchTimerRef = useRef(null)
  const [notificationApi, contextHolder] = notification.useNotification();

  // OpenWeatherMap'in ücretsiz API anahtarı
  const API_KEY = 'bc1301b0b23fe6ef52032a7e5bb70820'
  
  // Gece modu durumunu localStorage'a kaydet
  useEffect(() => {
    localStorage.setItem('darkMode', darkMode)
    document.body.className = darkMode ? 'dark-mode' : ''
  }, [darkMode])
  
  // API'dan şehir önerilerini al
  const fetchCitySuggestions = async (query) => {
    if (!query || query.length < 2) {
      setOptions([])
      return
    }
    
    setSearchLoading(true)
    try {
      // OpenWeather Geocoding API'sini kullanarak şehir önerilerini al (daha hızlı ve güvenilir)
      const response = await axios.get(`https://api.openweathermap.org/geo/1.0/direct`, {
        params: {
          q: query,
          limit: 15,
          appid: API_KEY
        }
      })
      
      // API'den gelen şehirleri işle
      const citiesData = response.data.map(city => ({
        value: city.name,
        country: city.country,
        state: city.state,
        lat: city.lat,
        lon: city.lon,
        category: city.country === 'TR' ? 'Türkiye' : 'Dünya'
      }))
      
      // Türkiye şehirleri
      const turkeyCities = citiesData.filter(city => city.country === 'TR')
      
      // Diğer şehirler
      const otherCities = citiesData.filter(city => city.country !== 'TR')
      
      setOptions([...turkeyCities, ...otherCities])
      setShowSuggestions(true)
    } catch (error) {
      console.error('Şehir önerileri alınırken hata oluştu:', error)
      
      // API'ya erişilemediğinde yerel verileri kullan
      const filteredTurkeyCities = popularCities
        .filter(city => city.value.toLowerCase().includes(query.toLowerCase()))
        .map(city => ({
          ...city,
          category: 'Türkiye',
          country: 'TR'
        }))
        
      const filteredWorldCities = worldCities
        .filter(city => city.value.toLowerCase().includes(query.toLowerCase()))
        .map(city => ({
          ...city,
          category: 'Dünya',
          country: 'Dünya'
        }))
      
      setOptions([...filteredTurkeyCities, ...filteredWorldCities])
      
      if (filteredTurkeyCities.length === 0 && filteredWorldCities.length === 0) {
        // Yerel verilerde de eşleşme bulunamadığında doğrudan kullanıcının girdiğini öneri olarak ekle
        setOptions([{
          value: query,
          category: 'Arama',
          country: 'Arama Sonucu'
        }])
      }
    } finally {
      setSearchLoading(false)
    }
  }

  const fetchWeatherData = async (searchCity) => {
    setLoading(true)
    setError(null)
    try {
      const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${searchCity}&appid=${API_KEY}&units=metric&lang=tr`)
      setWeatherData(response.data)
      // Başarılı mesajını göstermeyi kaldır
      // notificationApi.success({
      //   message: 'Başarılı',
      //   description: `${response.data.name} için hava durumu bilgileri yüklendi.`,
      //   placement: 'top',
      // })
    } catch (err) {
      setError('Hava durumu bilgisi alınamadı. Lütfen geçerli bir şehir adı giriniz.')
      notificationApi.error({
        message: 'Hata',
        description: 'Hava durumu bilgisi alınamadı. Lütfen geçerli bir şehir adı giriniz.',
        placement: 'top',
      })
    } finally {
      setLoading(false)
    }
  }

  // Sayfa yüklendiğinde varsayılan olarak İstanbul'un hava durumunu getir
  useEffect(() => {
    fetchWeatherData('istanbul')
  }, [])

  const handleSearch = (e) => {
    const value = e.target.value
    setInputValue(value)
    
    // Debounce uygula - kullanıcı yazmayı bıraktıktan sonra API çağrısı yap
    clearTimeout(searchTimerRef.current)
    
    if (!value || value.length < 2) {
      setOptions([])
      setShowSuggestions(false)
      return
    }
    
    searchTimerRef.current = setTimeout(() => {
      fetchCitySuggestions(value)
    }, 300)
  };

  const handleSelect = (city) => {
    setCity(city.value)
    setInputValue(city.value)
    fetchWeatherData(city.value)
    setShowSuggestions(false)
  }

  // Enter tuşuna basılınca arama yap
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      setCity(inputValue)
      fetchWeatherData(inputValue)
      setShowSuggestions(false)
    }
  }

  // Dışarı tıklandığında öneri kutusunu kapat
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [searchRef]);

  const getWeatherIcon = (iconCode) => {
    return `https://openweathermap.org/img/wn/${iconCode}@2x.png`
  }

  // Arka plan rengini ve parçacık renklerini hava durumuna göre değiştir
  const getBackgroundConfig = () => {
    const isDark = darkMode;
    
    if (!weatherData) {
      return {
        background: isDark ? '#0f172a' : '#1d3557',  // Koyu mavi (gece) / normal mavi (gündüz)
        particleColor: isDark ? '#64748b' : '#ffffff'
      };
    }
    
    const weatherId = weatherData.weather[0].id;
    const temp = weatherData.main.temp;
    
    // Sıcak günler
    if (temp > 25) {
      return {
        background: isDark ? '#881337' : '#ff5e62', // Koyu kırmızı (gece) / açık kırmızı (gündüz)
        particleColor: isDark ? '#fb7185' : '#FFCB8E'
      };
    }
    // Soğuk günler
    else if (temp < 10) {
      return {
        background: isDark ? '#172554' : '#7F7FD5', // Koyu lacivert (gece) / açık mavi (gündüz)
        particleColor: isDark ? '#93c5fd' : '#E0EAFC'
      };
    }
    // Yağmurlu günler
    else if (weatherId >= 200 && weatherId < 600) {
      return {
        background: isDark ? '#0f172a' : '#373B44', // Çok koyu mavi (gece) / koyu gri (gündüz)
        particleColor: isDark ? '#38bdf8' : '#4286f4'
      };
    }
    // Karlı günler
    else if (weatherId >= 600 && weatherId < 700) {
      return {
        background: isDark ? '#1e293b' : '#E0EAFC', // Koyu slate (gece) / açık mavi (gündüz)
        particleColor: isDark ? '#e2e8f0' : '#ffffff'
      };
    }
    // Sisli günler
    else if (weatherId >= 700 && weatherId < 800) {
      return {
        background: isDark ? '#1e293b' : '#606c88', // Koyu slate (gece) / gri-mavi (gündüz)
        particleColor: isDark ? '#94a3b8' : '#dbdbdb'
      };
    }
    // Açık hava
    else if (weatherId === 800) {
      return {
        background: isDark ? '#0c4a6e' : '#2980B9', // Koyu mavi (gece) / açık mavi (gündüz)
        particleColor: isDark ? '#7dd3fc' : '#ffffff'
      };
    }
    // Parçalı bulutlu
    else {
      return {
        background: isDark ? '#0f172a' : '#757F9A', // Koyu slate (gece) / gri-mavi (gündüz)
        particleColor: isDark ? '#94a3b8' : '#E0EAFC'
      };
    }
  }
  
  // Arka plan konfigürasyonunu sabitlemek için useMemo kullan
  const bgConfig = useMemo(() => getBackgroundConfig(), [weatherData, darkMode]);

  return (
    <ConfigProvider
      theme={{
        algorithm: darkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: darkMode ? '#60a5fa' : '#1d3557',
          borderRadius: 8,
          fontSize: 14,
          colorInfo: darkMode ? '#38bdf8' : '#4ca2cd',
          colorBgContainer: darkMode ? '#1e293b' : 'rgba(255, 255, 255, 0.9)',
          colorText: darkMode ? '#e2e8f0' : '#1e293b',
        },
        components: {
          Card: {
            colorBgContainer: darkMode ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)',
            boxShadow: darkMode ? '0 8px 20px rgba(0, 0, 0, 0.25)' : '0 8px 20px rgba(0, 0, 0, 0.15)',
            borderRadius: 12,
          },
          Button: {
            colorPrimary: darkMode ? '#38bdf8' : '#4ca2cd',
            borderRadius: 6,
            fontSize: 14,
          },
          Input: {
            borderRadius: 6,
          },
          Tag: {
            fontSize: 12,
          }
        }
      }}
    >
      {contextHolder}
      <div className={`container ${darkMode ? 'dark' : 'light'}`}>
        <div className="particles-container">
          <MemoizedSparklesCore
            id="tsparticles"
            background={bgConfig.background}
            particleColor={bgConfig.particleColor}
            particleDensity={100}
            speed={0.5}
            minSize={0.8}
            maxSize={2}
            className="particles-canvas"
          />
        </div>
        
        <Card className={`weather-card ${darkMode ? 'dark' : ''}`}>
          <div className="card-header">
            <Title level={3} className="app-title">
              <CloudOutlined style={{ marginRight: 8 }} />
              Hava Durumu
            </Title>
            
            <Switch
              checked={darkMode}
              onChange={checked => setDarkMode(checked)}
              checkedChildren={<MoonOutlined />}
              unCheckedChildren={<SunOutlined />}
              className="theme-switch"
            />
          </div>
          
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div className="modern-search-container" ref={searchRef}>
              <div className={`modern-search-input ${isSearchFocused ? 'focused' : ''}`}>
                <SearchOutlined className="search-icon" />
                <input
                  type="text"
                  value={inputValue}
                  onChange={handleSearch}
                  onFocus={() => {
                    setIsSearchFocused(true);
                    if (inputValue.length >= 2) setShowSuggestions(true);
                  }}
                  onBlur={() => setIsSearchFocused(false)}
                  onKeyDown={handleKeyDown}
                  placeholder="Şehir adı"
                  className="search-field"
                />
                {inputValue && (
                  <button 
                    className="clear-button" 
                    onClick={() => {
                      setInputValue('');
                      setOptions([]);
                    }}
                    aria-label="Temizle"
                  >
                    ×
                  </button>
                )}
              </div>
              
              {showSuggestions && options.length > 0 && (
                <div className={`suggestions-container ${darkMode ? 'dark' : ''}`}>
                  {/* Türkiye şehirleri */}
                  {options.filter(city => city.category === 'Türkiye').length > 0 && (
                    <>
                      <div className="suggestion-category">Türkiye</div>
                      {options
                        .filter(city => city.category === 'Türkiye')
                        .map((city, index) => (
                          <div 
                            key={`tr-${index}`} 
                            className="suggestion-item"
                            onClick={() => handleSelect(city)}
                          >
                            <span className="suggestion-icon tr">
                              <EnvironmentOutlined />
                            </span>
                            <span className="suggestion-text">
                              {city.value}
                              {city.state && city.state !== city.value && (
                                <span className="city-region">{city.state}</span>
                              )}
                            </span>
                          </div>
                        ))
                      }
                    </>
                  )}
                  
                  {/* Dünya şehirleri */}
                  {options.filter(city => city.category === 'Dünya').length > 0 && (
                    <>
                      <div className="suggestion-category">Dünya</div>
                      {options
                        .filter(city => city.category === 'Dünya')
                        .map((city, index) => (
                          <div 
                            key={`world-${index}`} 
                            className="suggestion-item"
                            onClick={() => handleSelect(city)}
                          >
                            <span className="suggestion-icon world">
                              <EnvironmentOutlined />
                            </span>
                            <span className="suggestion-text">
                              {city.value}
                              <span className="city-country">
                                {(() => {
                                  // ISO Ülke kodlarını ülke adına dönüştür
                                  const countryNames = {
                                    'US': 'Amerika',
                                    'GB': 'Birleşik Krallık',
                                    'FR': 'Fransa',
                                    'DE': 'Almanya',
                                    'IT': 'İtalya',
                                    'ES': 'İspanya',
                                    'RU': 'Rusya',
                                    'JP': 'Japonya',
                                    'CN': 'Çin',
                                    'IN': 'Hindistan',
                                    'BR': 'Brezilya',
                                    'CA': 'Kanada',
                                    'AU': 'Avustralya',
                                    'NL': 'Hollanda',
                                    'AE': 'Birleşik Arap Emirlikleri',
                                    'GR': 'Yunanistan',
                                    'MX': 'Meksika',
                                    'AT': 'Avusturya',
                                    'CH': 'İsviçre',
                                    'SE': 'İsveç',
                                    'NO': 'Norveç',
                                    'DK': 'Danimarka',
                                    'FI': 'Finlandiya',
                                    'PL': 'Polonya',
                                    'PT': 'Portekiz',
                                    'IE': 'İrlanda',
                                    'BE': 'Belçika',
                                    'CZ': 'Çekya',
                                    'SA': 'Suudi Arabistan',
                                    'EG': 'Mısır',
                                    'MA': 'Fas',
                                    'ZA': 'Güney Afrika',
                                    'TH': 'Tayland',
                                    'VN': 'Vietnam'
                                  };
                                  return countryNames[city.country] || city.country;
                                })()}
                              </span>
                              {city.state && city.state !== city.value && (
                                <span className="city-region">{city.state}</span>
                              )}
                            </span>
                          </div>
                        ))
                      }
                    </>
                  )}
                  
                  {/* Doğrudan arama sonucu */}
                  {options.filter(city => city.category === 'Arama').length > 0 && (
                    <>
                      <div className="suggestion-category">Diğer Şehirler</div>
                      {options
                        .filter(city => city.category === 'Arama')
                        .map((city, index) => (
                          <div 
                            key={`search-${index}`} 
                            className="suggestion-item"
                            onClick={() => handleSelect(city)}
                          >
                            <span className="suggestion-icon search">
                              <SearchOutlined />
                            </span>
                            <span className="suggestion-text">
                              {city.value}
                            </span>
                          </div>
                        ))
                      }
                    </>
                  )}
                  
                  {searchLoading && (
                    <div className="suggestion-loading">
                      <Spin size="small" />
                      <span>Şehirler aranıyor...</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <button 
              className="modern-search-button" 
              onClick={() => inputValue.trim() && fetchWeatherData(inputValue)}
              disabled={!inputValue.trim()}
            >
              <SearchOutlined />
              <span>Hava Durumunu Göster</span>
            </button>
            
            {loading ? (
              <div className="loading-container">
                <Spin size="default" />
                <Text className="loading-text">Yükleniyor...</Text>
              </div>
            ) : weatherData ? (
              <Card className="result-card" variant="borderless">
                <Row gutter={[16, 16]} align="middle">
                  <Col xs={24} sm={12}>
                    <div className="city-info">
                      <Title level={4} className="city-name">
                        <EnvironmentOutlined /> {weatherData.name}, {weatherData.sys.country}
                      </Title>
                      <div className="weather-main">
                        <img 
                          src={getWeatherIcon(weatherData.weather[0].icon)} 
                          alt={weatherData.weather[0].description} 
                          className="weather-icon"
                        />
                        <div>
                          <div className="temperature">
                            {Math.round(weatherData.main.temp)}°C
                          </div>
                          <Text className="weather-description">
                            {weatherData.weather[0].description}
                          </Text>
                        </div>
                      </div>
                    </div>
                  </Col>
                  
                  <Col xs={24} sm={12}>
                    <div className="weather-details">
                      <Row gutter={[16, 16]}>
                        <Col xs={12}>
                          <Tag color="blue" className="detail-tag">Hissedilen</Tag>
                          <div className="detail-value">{Math.round(weatherData.main.feels_like)}°C</div>
                        </Col>
                        <Col xs={12}>
                          <Tag color="green" className="detail-tag">Nem</Tag>
                          <div className="detail-value">{weatherData.main.humidity}%</div>
                        </Col>
                        <Col xs={12}>
                          <Tag color="gold" className="detail-tag">Rüzgar</Tag>
                          <div className="detail-value">{Math.round(weatherData.wind.speed)} m/s</div>
                        </Col>
                        <Col xs={12}>
                          <Tag color="purple" className="detail-tag">Basınç</Tag>
                          <div className="detail-value">{weatherData.main.pressure} hPa</div>
                        </Col>
                      </Row>
                    </div>
                  </Col>
                </Row>
                <div className="weather-time">
                  <Text type="secondary">Son güncelleme: {new Date().toLocaleTimeString('tr-TR')}</Text>
                </div>
              </Card>
            ) : error ? (
              <div className="error-message">
                <ThunderboltOutlined style={{ fontSize: '24px', marginBottom: '8px' }} />
                <Text>{error}</Text>
              </div>
            ) : (
              <div className="welcome-message">
                <Title level={5}>Hoş Geldiniz!</Title>
                <Text>Hava durumunu öğrenmek istediğiniz şehri yukarıdaki arama kutusuna yazınız.</Text>
              </div>
            )}
          </Space>
          
          <div className="footer">
            <Text type="secondary">
              Veriler OpenWeatherMap API'dan alınmaktadır.
            </Text>
            <p className="creator-text">Created by Jacob</p>
          </div>
        </Card>
      </div>
    </ConfigProvider>
  )
}

export default App
