'use client';

import { useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon, ClockIcon } from 'lucide-react';

interface DayData {
  date: string;
  day_name: string;
  items: any[];
  item_count: number;
  completion_rate: number;
}

interface WeeklyGridProps {
  data: DayData[];
}

interface ItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  day: DayData;
}

function ItemModal({ isOpen, onClose, day }: ItemModalProps) {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              {day.day_name} - {new Date(day.date).toLocaleDateString()}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="mt-2 flex items-center space-x-4 text-sm text-gray-600">
            <span className="flex items-center">
              <CalendarIcon className="w-4 h-4 mr-1" />
              {day.item_count} items
            </span>
            <span className="flex items-center">
              <ClockIcon className="w-4 h-4 mr-1" />
              {day.completion_rate}% completed
            </span>
          </div>
        </div>
        
        <div className="p-6 max-h-96 overflow-y-auto">
          {day.items.length > 0 ? (
            <div className="space-y-3">
              {day.items.map((item, index) => (
                <div
                  key={item.id || index}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{item.title}</h4>
                      {item.content && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                          {item.content}
                        </p>
                      )}
                      <div className="flex items-center space-x-3 mt-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {item.item_type}
                        </span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          item.status === 'completed' || item.status === 'done'
                            ? 'bg-green-100 text-green-800'
                            : item.status === 'in_progress'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {item.status}
                        </span>
                      </div>
                      {item.tags && item.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {item.tags.slice(0, 3).map((tag: string, tagIndex: number) => (
                            <span
                              key={tagIndex}
                              className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700"
                            >
                              {tag}
                            </span>
                          ))}
                          {item.tags.length > 3 && (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
                              +{item.tags.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 ml-4">
                      {new Date(item.created_at).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <CalendarIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No items for this day</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DayCard({ day, onClick }: { day: DayData; onClick: () => void }) {
  const dayName = day.day_name.substring(0, 3);
  const dayNumber = new Date(day.date).getDate();
  const isToday = new Date(day.date).toDateString() === new Date().toDateString();
  
  return (
    <button
      onClick={onClick}
      className={`w-full p-4 rounded-lg border transition-all duration-200 hover:shadow-md hover:scale-105 text-left ${
        isToday
          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className={`text-sm font-medium ${
            isToday ? 'text-blue-700' : 'text-gray-600'
          }`}>
            {dayName}
          </p>
          <p className={`text-lg font-bold ${
            isToday ? 'text-blue-900' : 'text-gray-900'
          }`}>
            {dayNumber}
          </p>
        </div>
        {day.item_count > 0 && (
          <div className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
            isToday
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-700'
          }`}>
            {day.item_count}
          </div>
        )}
      </div>
      
      {day.item_count > 0 && (
        <>
          <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                day.completion_rate >= 80
                  ? 'bg-green-500'
                  : day.completion_rate >= 50
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              }`}
              style={{ width: `${day.completion_rate}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-600">
            {day.completion_rate}% complete
          </p>
        </>
      )}
      
      {day.item_count === 0 && (
        <p className="text-xs text-gray-400 mt-2">No activity</p>
      )}
    </button>
  );
}

export default function WeeklyGrid({ data }: WeeklyGridProps) {
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null);
  const [currentWeek, setCurrentWeek] = useState(0);
  
  const handleDayClick = (day: DayData) => {
    setSelectedDay(day);
  };
  
  const handleCloseModal = () => {
    setSelectedDay(null);
  };
  
  const navigateWeek = (direction: 'prev' | 'next') => {
    // For now, just update the state. In a real app, this would trigger a new API call
    setCurrentWeek(prev => direction === 'next' ? prev + 1 : prev - 1);
  };
  
  const totalItems = data.reduce((sum, day) => sum + day.item_count, 0);
  const avgCompletionRate = data.length > 0
    ? Math.round(data.reduce((sum, day) => sum + day.completion_rate, 0) / data.length)
    : 0;
  
  return (
    <div className="space-y-6">
      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigateWeek('prev')}
          className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
        >
          <ChevronLeftIcon className="w-4 h-4 mr-1" />
          Previous Week
        </button>
        
        <div className="text-center">
          <p className="text-sm text-gray-600">
            Week of {data[0] && new Date(data[0].date).toLocaleDateString('en-US', { 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
          <div className="flex items-center justify-center space-x-4 mt-1 text-xs text-gray-500">
            <span>{totalItems} total items</span>
            <span>•</span>
            <span>{avgCompletionRate}% avg completion</span>
          </div>
        </div>
        
        <button
          onClick={() => navigateWeek('next')}
          className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
        >
          Next Week
          <ChevronRightIcon className="w-4 h-4 ml-1" />
        </button>
      </div>
      
      {/* Week Grid */}
      <div className="grid grid-cols-7 gap-4">
        {data.map((day, index) => (
          <DayCard
            key={day.date}
            day={day}
            onClick={() => handleDayClick(day)}
          />
        ))}
      </div>
      
      {/* Item Modal */}
      {selectedDay && (
        <ItemModal
          isOpen={!!selectedDay}
          onClose={handleCloseModal}
          day={selectedDay}
        />
      )}
    </div>
  );
}